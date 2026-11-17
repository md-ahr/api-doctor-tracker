---
name: add-api-endpoint
description: Adds one Doctor Tracker REST endpoint across Zod, OpenAPI, the model query, the service rule, and the route envelope. Use when adding or changing an API path, status code, request body, or response message.
---

# Add an endpoint

Do this only when `docs/lld.md` already names the path. If it does not, update the LLD first and wait for confirmation.

## Order

1. Path, body, success message, and error codes in the LLD.
2. Zod schema in `src/schemas/`. Unknown keys stripped. Id params are 24 hex characters.
3. Register the path in `src/docs/openapi.ts` with `@asteasolutions/zod-to-openapi`, including 401, 403, 404, and 409 when the LLD lists them.
4. Model function, if the query is new. Return a lean object or `null`.
5. Service function named in LLD section 5.2. Throw `DomainError`. No `req` or `res`.
6. Route handler: one service call, one `sendData` or `sendList`. Mount a new router in `app.ts`.
7. `requireAdmin` unless the LLD marks the route public.

## Messages

Use the LLD sentence, for example `Doctor created successfully`. List messages name the collection, not a row.

## Public routes

Health, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, and Swagger. Refresh and logout document the `dt_refresh` cookie and the `Origin` header. They do not use the bearer scheme.

## Check

- Invalid ids are `VALIDATION_ERROR`.
- Duplicate doctor email, including MongoDB code `11000`, is `EMAIL_IN_USE`.
- Missing active doctor or patient is the matching `404` code.
- The handler does not import a model.
