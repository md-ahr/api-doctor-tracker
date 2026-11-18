# Doctor Tracker API

Express API for the admin portal: identity, the doctor directory, the patient registry, and the dashboard read model. MongoDB is the only database. The web app is a separate repository and talks to this API over HTTP.

## Production

| Endpoint | URL                                                              |
| -------- | ---------------------------------------------------------------- |
| Health   | https://doctor-tracker-api.ahr-web-pro.workers.dev/api/v1/health |
| API docs | https://doctor-tracker-api.ahr-web-pro.workers.dev/api/docs      |

Health reports whether MongoDB answers. API docs is Swagger UI. The OpenAPI document is the same host at `/api/docs/openapi.json`, generated from the Zod schemas.

## Requirements

- Node.js 22 (see `.nvmrc`)
- A [MongoDB Atlas](https://www.mongodb.com/atlas) cluster (no local MongoDB install)

## Setup

```bash
cp .env.example .env
npm install
```

In Atlas, create a database user and put the **SRV connection string** in `MONGODB_URI` (see `.env.example`). Allow your IP under **Network Access** for local dev, or use **Allow access from anywhere** (`0.0.0.0/0`) if you only run the API on Cloudflare and seed from your machine occasionally.

Set every value in `.env` before `npm run dev`. `JWT_ACCESS_SECRET` must be at least 32 characters. `FRONTEND_ORIGIN` is a comma-separated allowlist of portal origins with no trailing slash (`http://localhost:3000,https://task-doctor-tracker.vercel.app`). `APP_TIMEZONE` is an IANA name (`UTC` or `Asia/Dhaka`) used for calendar-day bounds.

| Variable                                      | Role                                                                   |
| --------------------------------------------- | ---------------------------------------------------------------------- |
| `MONGODB_URI`                                 | Atlas SRV connection string                                            |
| `JWT_ACCESS_SECRET`                           | HMAC secret for the 15-minute access token                             |
| `FRONTEND_ORIGIN`                             | Comma-separated CORS allowlist. Refresh/logout `Origin` must match one |
| `PORT`                                        | Listen port. Defaults to `4000`                                        |
| `NODE_ENV`                                    | `development`, `test`, or `production`                                 |
| `APP_TIMEZONE`                                | Timezone for `YYYY-MM-DD` windows. Defaults to `UTC`                   |
| `LOG_LEVEL`                                   | pino level. Defaults to `info`                                         |
| `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Required only for `npm run seed`                                       |

`npm run seed` inserts that admin when the email is missing. Running it again does not create a second admin.

`npm run seed:all` adds demo clinic data: 9 staff users (`role: user`, password `12345678`), 100 doctors, and 1,000 patients with Bangladesh-style names, hospitals, and phone numbers. It top-ups missing rows when counts are below those targets.

`npm run seed:clean` removes demo doctors, patients, sessions, and staff users. The configured admin account is kept when `ADMIN_EMAIL` is set.

`npm run seed:reset` runs clean, then `seed:all` (admin plus the full demo dataset).

## Scripts

| Script                 | What it does                           |
| ---------------------- | -------------------------------------- |
| `npm run dev`          | Start the API with a reload watcher    |
| `npm start`            | Run the compiled server in `dist/`     |
| `npm run build`        | Compile `src/` to `dist/`              |
| `npm run typecheck`    | Typecheck `src/` and `tests/`          |
| `npm test`             | Run the Vitest suite                   |
| `npm run lint`         | ESLint with zero warnings              |
| `npm run format:check` | Check Prettier                         |
| `npm run seed`         | Insert the admin when missing          |
| `npm run seed:all`     | Admin (if missing) + demo clinic data  |
| `npm run seed:clean`   | Remove demo doctors, patients, staff   |
| `npm run seed:reset`   | Clean, then load the full demo dataset |

Locally, `GET /api/v1/health` checks MongoDB, `GET /api/docs` is Swagger UI, and `GET /api/docs/openapi.json` is the OpenAPI document. Production URLs are under [Production](#production).

## Cloudflare deployment

Production on Cloudflare uses a **Worker** plus **Container** (this Express app in Docker). MongoDB remains external (Atlas). Full steps, secrets, and CI: [docs/deploy-cloudflare.md](docs/deploy-cloudflare.md).

```bash
npx wrangler login
# set Worker secrets (see deploy doc)
npm run deploy:cf
```

**GitHub:** push to `main` runs CI; when checks pass, the workflow deploys to Cloudflare. Add repo secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` — see [docs/deploy-cloudflare.md](docs/deploy-cloudflare.md).

## Technical decisions

**Access is a 15-minute HS256 JWT. The session is an opaque refresh token, stored as a hash and rotated on use.** The access token is returned in the JSON body. The refresh token is 32 random bytes, stored only as SHA-256, and set as `dt_refresh` (`HttpOnly`, `Secure`, `SameSite=None`, path `/api/v1/auth`). Refresh revokes the current session before it issues the next one, so a stolen cookie cannot be replayed after the legitimate client refreshes. Login always runs argon2id, including a fixed dummy hash when the email is missing, so timing does not reveal whether the account exists. Refresh and logout reject any `Origin` not in the `FRONTEND_ORIGIN` allowlist. Login is limited to 10 attempts per 15 minutes.

**One Zod schema is the runtime check and the published contract.** `validate` parses body, query, and params and puts the result on `res.locals`. Controllers do not parse again. The same schemas are registered with `zod-to-openapi` and served at `/api/docs`. A second, hand-written OpenAPI file would drift from what the server accepts. Services throw `DomainError`. One error handler writes the JSON envelope, so status codes and error codes stay in one place.

**Dashboard figures are computed when the dashboard is read.** A counter on the doctor would make every patient write update two documents. Those writes need a transaction, and a missed decrement stays wrong until someone notices. Counts come from indexed `$group` queries. The service then fills days and conditions that returned no rows with zero, and rejects a window longer than 366 days. A stored counter is worth adding only if this read misses its latency budget. Day bounds use Temporal in `APP_TIMEZONE`, so a `YYYY-MM-DD` window does not follow the container clock.

**Indexes are declared on the models and created explicitly at startup.** `autoIndex` is off. Boot calls `createIndexes()`, not `syncIndexes()`, so a deploy cannot drop an index that application code still queries. Reads return `.lean()` objects. Expired sessions are removed by a TTL index on `expiresAt` rather than a sweeper job.
