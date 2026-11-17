# Library rules for the API

Query Context7 for the current function signature. The rows below are how this codebase uses the library.

| Package | Project rule |
| --- | --- |
| `express` | `app.ts` order: request id, pino-http, helmet, CORS, JSON 16 KB, login rate limit, Swagger, `/api/v1` routers, 404, error handler |
| `cors` | `origin: FRONTEND_ORIGIN`, `credentials: true`, methods `GET, POST, PATCH, DELETE`, headers `Authorization, Content-Type` |
| `helmet` | Default helmet on the app. No custom CSP work in this build |
| `express-rate-limit` | `POST /auth/login` only. 10 per 15 minutes per IP. Handler responds `429` / `RATE_LIMITED` |
| `mongoose` | `autoIndex: false`. Queries in model files. `.lean()`. Duplicate key `11000` mapped in the doctor service |
| `mongodb-memory-server` | Model tests and Phase 12 HTTP tests. Not imported by `src/` |
| `zod` | One schema module per feature. `safeParse` in middleware. Strip unknown keys |
| `@asteasolutions/zod-to-openapi` | `src/docs/openapi.ts` imports schemas only. Shared envelope components |
| `swagger-ui-express` | `GET /api/docs` loads `GET /api/docs/openapi.json`. Public |
| `argon2` | Hash and verify live in `lib/password.ts`. Dummy hash for unknown emails |
| `jsonwebtoken` | Sign and verify live in `lib/tokens.ts`. HS256. `expiresIn` 900 seconds |
| `pino`, `pino-http` | `lib/logger.ts`. Level from `LOG_LEVEL`, default `info`. Redact secrets |
| Temporal | `PlainDate` for `YYYY-MM-DD`. `ZonedDateTime` in `APP_TIMEZONE` for day bounds. Node 22, no polyfill |
| `vitest` | `npm test`. ESM. `tests/setup.ts` sets `NODE_ENV=test` and loads dotenv |
| `supertest` | Phase 12 only, against the Express app and a test database |
| `dotenv` | Local and test env. Production env comes from the host. Parse with Zod in `config/env.ts` |
| ESLint | Flat config. `no-console` is error, including tests. `eslint-config-prettier` last |
| Prettier | Semicolons, double quotes, trailing commas, print width 100 |
| Lefthook | pre-commit format and lint, commit-msg commitlint, pre-push typecheck then test |
| commitlint | Conventional Commits. `subject-max-length` 50. `header-max-length` 72. `subject-case` off |

## Environment keys

`MONGODB_URI`, `JWT_ACCESS_SECRET`, `FRONTEND_ORIGIN`, `PORT` (4000), `NODE_ENV`, `APP_TIMEZONE` (UTC), `LOG_LEVEL` (info), and seed-only `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`. Ship them empty in `.env.example`.

## Context7 queries that pay off

- Mongoose `lean`, collation, partial indexes, `createIndexes`
- Zod object strip and `z.string().regex` for 24-hex ids
- zod-to-openapi `OpenAPIRegistry` and `OpenApiGeneratorV3`
- argon2 `hash` and `verify` options used for a dummy hash of the same shape
- express-rate-limit v7 `handler`
- Vitest `vi.mock` with NodeNext ESM
