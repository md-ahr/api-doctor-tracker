---
name: api-security
description: Applies Doctor Tracker API controls for CSRF, XSS, SSRF, NoSQL injection, auth, and secret exposure. Use when changing login, cookies, JWT, CORS, queries, search, error responses, or any outbound HTTP call.
---

# API security

Read [reference.md](reference.md) for the pattern that matches the change. The LLD wins if a line here and the LLD ever differ.

## Before editing

1. Name the risk: CSRF, XSS, SSRF, injection, broken auth, or secret exposure.
2. Keep the control already in the LLD. Do not replace it with a generic middleware from memory.
3. Confirm a library signature with Context7 when the call is new.

## Hard stops

- A URL from `req` is passed to `fetch`, axios, `got`, or `http.request`.
- `req.body` or `req.query` is passed through to a Mongoose filter.
- Search text reaches a regex before `escapeRegex`.
- `jwt.verify` omits `algorithms: ["HS256"]`.
- Refresh or logout accepts the cookie without comparing `Origin` to `FRONTEND_ORIGIN`.
- A response or log includes `passwordHash`, `tokenHash`, the refresh token, or the access token.
