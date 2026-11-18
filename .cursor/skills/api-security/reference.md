# API security patterns

## CSRF

The access token is a bearer header, so a foreign site cannot attach it. The refresh cookie is `SameSite=None` because the portal and the API are different origins. That cookie is the CSRF target.

Refresh and logout accept the cookie only when `Origin` matches one entry in the comma-separated `FRONTEND_ORIGIN` allowlist. Login sets the cookie. Logout clears it. Flags stay `HttpOnly`, `Secure`, `SameSite=None`, `Path=/api/v1/auth`.

Do not switch the cookie to `SameSite=Lax` to "fix" CSRF. Lax drops the cookie on the cross-site XHR this design needs. Do not skip the Origin check.

## XSS

Responses are `application/json` from `lib/response.ts`. A field such as `notes` or `name` is data, not markup. Do not `res.send` an HTML string built from the request. Validation and `INTERNAL` errors omit the stack.

## SSRF

This process talks to MongoDB and to the admin's browser. It does not call a URL supplied by the client.

```typescript
// Rejected: the host comes from the request
await fetch(req.body.avatarUrl);

// The API has no outbound URL feature
```

Health checks the database connection. It does not HTTP-ping a host from the query string.

## NoSQL injection and ReDoS

Build the filter in the service from parsed fields. The model receives that object.

```typescript
// Rejected
doctorModel.search(req.query);

// Required
const pattern = escapeRegex(input.q);
doctorModel.search({ specialization, pattern, page, limit });
```

No `$where`. No user string concatenated into a `$regex` without `escapeRegex`. `limit` stays 1–50.

## Auth and secrets

`jwt.verify(token, secret, { algorithms: ["HS256"] })`. A missing admin still verifies a dummy argon2 hash, then throws `INVALID_CREDENTIALS`. The session stores `sha256(cookie)`, not the cookie. `requireAdmin` is the only role gate.

Never select `passwordHash` into a resource. Never log the bearer token, the cookie, or either hash. Login stays rate-limited at 10 requests per 15 minutes per IP.

## Other requests that do not belong

| Request | Why it stays out |
| --- | --- |
| Open redirect | No `res.redirect(req.query.next)` |
| Path traversal | No user path is read from disk |
| File upload | Not in the LLD |
| Prototype merge | Do not `Object.assign` a document from `req.body` |
| CORS `origin: true` | The origin must match one entry in the `FRONTEND_ORIGIN` allowlist |
| Helmet removed | Leave the default helmet middleware in place |
