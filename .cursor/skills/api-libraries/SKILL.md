---
name: api-libraries
description: Applies Doctor Tracker constraints for Express, Mongoose, Zod, OpenAPI, argon2, JWT, pino, Temporal, Vitest, and the security middleware. Use when calling one of these libraries, choosing an API, or upgrading a dependency in the API repo. Query Context7 for current signatures.
---

# API libraries

Read [reference.md](reference.md) for the project rule on each package.

## Before using a library API

1. Prefer the helper this repo already owns (`lib/response.ts`, `lib/calendar.ts`, `lib/errors.ts`, `lib/password.ts`, `lib/tokens.ts`, `lib/logger.ts`).
2. If the signature is not in that helper, call the `context7` MCP: resolve the library id, then query the docs. Do not send secrets in the query.
3. Use the `mongodb` MCP only to inspect data or an explain plan. It is read-only. Indexes are declared in model files and built with `createIndexes()`.

## Defaults

| Need | Use |
| --- | --- |
| HTTP | Express middleware order in `docs/backend-structure.md` section 5 |
| Validation | Zod schema next to the feature, applied by `middleware/validate.ts` |
| Persistence | Mongoose model functions, `.lean()` |
| Password | `argon2` inside `lib/password.ts` |
| Access token | `jsonwebtoken` inside `lib/tokens.ts`, HS256 |
| Logs | `pino` / `pino-http` |
| Calendar | `Temporal.PlainDate` and `Temporal.ZonedDateTime` in `lib/calendar.ts` |
| Tests | Vitest. Models use `mongodb-memory-server`. Routes use `supertest` |
| API docs | `@asteasolutions/zod-to-openapi` and `swagger-ui-express` |

Do not add Luxon, date-fns, Day.js, Prisma, or TypeORM.
