# Doctor Tracker API

Express API for the admin portal: identity, the doctor directory, the patient registry, and the dashboard read model. MongoDB is the only database. The web app is a separate repository and talks to this API over HTTP.

## Requirements

- Node.js 22 (see `.nvmrc`)
- A MongoDB database

## Setup

```bash
cp .env.example .env
npm install
```

Set every value in `.env` before `npm run dev`. `JWT_ACCESS_SECRET` must be at least 32 characters. `FRONTEND_ORIGIN` is the portal origin with no trailing slash. `APP_TIMEZONE` is an IANA name (`UTC` or `Asia/Dhaka`) used for calendar-day bounds.

| Variable                                      | Role                                                          |
| --------------------------------------------- | ------------------------------------------------------------- |
| `MONGODB_URI`                                 | Mongo connection string                                       |
| `JWT_ACCESS_SECRET`                           | HMAC secret for the 15-minute access token                    |
| `FRONTEND_ORIGIN`                             | Allowed CORS origin. Refresh and logout require this `Origin` |
| `PORT`                                        | Listen port. Defaults to `4000`                               |
| `NODE_ENV`                                    | `development`, `test`, or `production`                        |
| `APP_TIMEZONE`                                | Timezone for `YYYY-MM-DD` windows. Defaults to `UTC`          |
| `LOG_LEVEL`                                   | pino level. Defaults to `info`                                |
| `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Required only for `npm run seed`                              |

`npm run seed` inserts that admin when the email is missing. Running it again does not create a second admin.

## Scripts

| Script                 | What it does                        |
| ---------------------- | ----------------------------------- |
| `npm run dev`          | Start the API with a reload watcher |
| `npm start`            | Run the compiled server in `dist/`  |
| `npm run build`        | Compile `src/` to `dist/`           |
| `npm run typecheck`    | Typecheck `src/` and `tests/`       |
| `npm test`             | Run the Vitest suite                |
| `npm run lint`         | ESLint with zero warnings           |
| `npm run format:check` | Check Prettier                      |
| `npm run seed`         | Insert the admin when missing       |

`GET /api/v1/health` reports whether MongoDB answers. `GET /api/docs` is Swagger UI. `GET /api/docs/openapi.json` is the OpenAPI document generated from the Zod schemas.

## Technical decisions

**Server data lives in TanStack Query, not a client store such as Redux.** Doctor and patient screens are a cache of this API. They need request keys, invalidation after a write, and de-duplication of in-flight reads. A client store would copy the same payloads into reducers and still need that cache. Redux fits shared client state. The shared state here is server state. The access token stays in a module variable in the web app. It is not stored in Redux and not written to `localStorage`.

**Dashboard figures are aggregated when the dashboard is read, not stored as a counter on the doctor.** A counter would make every patient write update two documents. Those writes need a transaction to stay correct, and a missed decrement stays wrong. Counts are computed with indexed `$group` queries, then the service fills missing days and conditions with zero. At the expected size that aggregation is the simpler correct design. A stored counter is worth adding only if this read stops meeting the latency budget.
