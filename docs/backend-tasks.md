# Doctor Tracker API — Backend task breakdown

> **Contracts:** `docs/lld.md`, `docs/backend-structure.md`, `docs/hld.md`
> **Workflow:** Implement **one task**, run **that task’s unit tests**, then move on. Do not stack unfinished tasks.

**Goal:** Build the Express API in small, reviewable steps. Every step leaves the repo in a testable state.

**Architecture:** Feature folders (`routes` → `controllers` → `services` → `models`), shared `lib` and `middleware`, MongoDB via Mongoose. Services throw `DomainError`; controllers write the JSON envelope only.

**Tech stack:** Node.js 22+, Express, TypeScript (strict), Mongoose, Zod, Vitest, argon2, jsonwebtoken, Temporal (native), pino.

## Global constraints

- API lives in its **own repository** (sibling to the Next.js app). Paths below use `api/` as the repo root.
- ESM with **NodeNext**; import paths use the `.js` extension in TypeScript source.
- No service imports another service. Patient rules call `doctor.model`, not `doctor.service`.
- Routes declare the path and middleware only. Controllers call exactly one service function and write the envelope. Neither routes nor controllers import models.
- Calendar: **Temporal only** — no Luxon, date-fns, or Day.js.
- List `totalPages`: `0` when `total === 0`, else `ceil(total / limit)`.
- Unknown route: `404`, `VALIDATION_ERROR`, message `Route not found`.
- Models: `autoIndex: false`; indexes created in `createIndexes()` on startup.

## How to use this document

| Step | Action                                                                                  |
| ---- | --------------------------------------------------------------------------------------- |
| 1    | Pick the **lowest-numbered open task** (first `- [ ]`).                                 |
| 2    | Create or change only the files listed for that task.                                   |
| 3    | Add or extend the listed **unit test file** first when the task says TDD-friendly.      |
| 4    | Run the **verify command**; all tests for that task must pass.                          |
| 5    | Check the task box, commit using `docs/commit-guidelines.md`, then start the next task. |

### What counts as a unit test here

| Layer                                 | Unit test style                                                                     |
| ------------------------------------- | ----------------------------------------------------------------------------------- |
| `lib/*`, `config/env` (with env stub) | Pure functions, no database                                                         |
| `schemas/*`                           | `schema.safeParse` / `parse` fixtures                                               |
| `services/*`                          | **Mock** `models/*` exports (`vi.mock`); assert rules and `DomainError` codes       |
| `middleware/*`                        | Mock `req` / `res` / `next`                                                         |
| `models/*`                            | **Repository tests** on `mongodb-memory-server` (one task at a time); not full HTTP |

**Integration / API tests** (real Mongo, supertest) are listed in [Phase 12](#phase-12-integration-and-verification). Run those after the unit tests for the related feature are green. LLD §8 still expects them before submission.

### Default verify commands

```bash
cd api
npm test                          # full suite so far
npm test -- tests/lib/errors.test.ts   # single file
```

---

## Phase 0 — Repository and test runner

Do these four tasks in order. Each one is config and a verify command. No feature code.

### Task 0.1 — API package scaffold

- [x] **Deliverable:** Empty API repo typechecks, builds, and Vitest runs one smoke test.

**Files:**

- Create: `api/package.json`, `api/tsconfig.json`, `api/tsconfig.build.json`, `api/vitest.config.ts`, `api/.env.example`, `api/.gitignore`, `api/.nvmrc`, `api/src/.gitkeep`
- Create: `api/tests/setup.ts` (set `NODE_ENV=test`, load dotenv)
- Create: `api/tests/smoke.test.ts`

**Implement:**

- `"type": "module"`, `"private": true`, `"engines": { "node": ">=22" }`
- `.nvmrc` contains `22`. CI reads this file.
- Scripts: `build`, `dev`, `start`, `seed`, `test`, `test:watch`, `typecheck`
- `typecheck` is `tsc --noEmit` over `src` and `tests`. `build` emits `src` only (`tsc -p tsconfig.build.json`) to `dist/`.
- Dependencies per LLD §4.1 (express, mongoose, zod, `@asteasolutions/zod-to-openapi`, swagger-ui-express, argon2, jsonwebtoken, helmet, cors, express-rate-limit, pino, pino-http, dotenv). Dev: typescript, tsx, vitest, `@types/*`.
- `tsconfig`: `strict: true`, `module: NodeNext`, `moduleResolution: NodeNext`, `verbatimModuleSyntax: true`. Build config sets `outDir: dist`, `rootDir: src`.
- `.gitignore`: `node_modules/`, `dist/`, `coverage/`, `.env`, `.env.*` except `.env.example`.
- `.env.example` lists every key in LLD §4.3 with empty secrets.
- Smoke test asserts `true`. Do not add `src/server.ts` here. Task 4.3 creates it. Until then, `build` needs at least one file under `src/` or `tsc` reports no inputs — keep a typed placeholder only if the build script cannot run without it, and replace it in Task 4.3.

**Verify:** `cd api && npm test && npm run typecheck`

---

### Task 0.2 — ESLint and Prettier

- [x] **Deliverable:** Lint fails on `console.*`. Format is checked in one command. Prettier does not fight ESLint.

**Files:**

- Create: `api/eslint.config.js`, `api/.prettierrc.json`, `api/.prettierignore`
- Modify: `api/package.json` scripts

**Implement:**

- ESLint flat config. Bases: `@eslint/js` recommended, `typescript-eslint` recommended. Last: `eslint-config-prettier` so format rules are not duplicated.
- Rule `no-console` is `"error"` everywhere, including tests. Logging later goes through `pino` in `lib/logger.ts`. No `console` allow-list.
- Ignore `dist/`, `node_modules/`, `coverage/`.
- Prettier: semicolons, double quotes, trailing commas, print width 100. This matches the snippets in `docs/backend-structure.md`.
- `.prettierignore`: `dist`, `node_modules`, `coverage`, `package-lock.json`.
- Scripts: `lint` (`eslint . --max-warnings 0`), `lint:fix`, `format`, `format:check`.
- Dev dependencies: `eslint`, `@eslint/js`, `typescript-eslint`, `prettier`, `eslint-config-prettier`.

**Verify:** `npm run lint && npm run format:check`. A temporary `console.log` in a scratch file must fail lint; remove that file before the task is done.

---

### Task 0.3 — Lefthook

- [x] **Deliverable:** Commits are formatted, linted, and message-checked. Pushes run typecheck and tests.

**Files:**

- Create: `api/lefthook.yml`, `api/commitlint.config.js`
- Modify: `api/package.json` — dev dependency `lefthook`, `@commitlint/cli`, `@commitlint/config-conventional`, and a `prepare` script `lefthook install`

**Hooks:**

| Hook         | What it runs                                                                                                                                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pre-commit` | Prettier write and ESLint `--fix` on staged files, in parallel. Lefthook `stage_fixed: true` so the fixed files are part of the commit.                                                                            |
| `commit-msg` | `commitlint --edit`. Extends `@commitlint/config-conventional`. `subject-max-length` 50. `header-max-length` 72. Turn `subject-case` off so names like `API` are allowed. Rules match `docs/commit-guidelines.md`. |
| `pre-push`   | `npm run typecheck`, then `npm test`. Not parallel.                                                                                                                                                                |

`prepare` only succeeds after `api/` is its own git repository. Do not pass `--no-verify`.

**Verify:** `npx lefthook run pre-commit` and `npx commitlint --edit` against a sample message file. A subject longer than 50 characters must fail.

---

### Task 0.4 — CI pipeline

- [x] **Deliverable:** GitHub Actions runs the same checks as the hooks on every push and pull request.

**Files:**

- Create: `api/.github/workflows/ci.yml`

**Pipeline:**

- Triggers: `push` to `main` and `master`, and `pull_request`.
- Concurrency group per ref, cancel in-progress runs.
- Job on `ubuntu-latest`: checkout, `actions/setup-node` with `node-version-file: .nvmrc` and npm cache, then `npm ci`, `format:check`, `lint`, `typecheck`, `test`, `build`.
- The workflow file must sit at the **git root** of the API repository. GitHub does not run `.github` nested inside a subfolder of a larger repo. If this docs folder is the git root, the workflow belongs at the repository root and every step uses `working-directory: api`.

This job is CI only. It does not deploy.

**Verify:** `npm run format:check && npm run lint && npm run typecheck && npm test && npm run build` locally. After the first push, the Actions tab is green.

---

### Hold until a later phase

These are useful and **not** part of Phase 0. Add them when the note says.

| Item                                   | When                                                                                                                                                 |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deploy workflow (CD) to Render         | After Task 4.3, when `server.ts` listens. Needs a Render service and a secret for the deploy hook. Do not add a deploy job that has nothing to boot. |
| MongoDB service in CI                  | Phase 3, when model tests use `mongodb-memory-server` or a GitHub Actions Mongo service.                                                             |
| Coverage threshold                     | After Phase 1, once there is more than the smoke test. Report in CI; do not fail the build on a number picked too early.                             |
| Dependabot or Renovate                 | After the lockfile exists and the repo is on GitHub. Group minor npm updates weekly.                                                                 |
| EditorConfig                           | Optional. Prettier already owns formatting. Add `.editorconfig` only if editors disagree before Prettier runs.                                       |
| Secret scan (gitleaks) on `pre-commit` | Optional. `.gitignore` already blocks `.env`. A scanner catches a secret pasted into a source file.                                                  |
| `npm audit` in CI                      | Optional and noisy on transitive issues. Run on a schedule, not as a required check on every pull request.                                           |

---

## Phase 1 — Shared libraries (no HTTP)

### Task 1.1 — Environment config

- [x] **Deliverable:** `env` parses required variables and fails fast on invalid input.

**Files:**

- Create: `api/src/config/env.ts` (Zod schema per `docs/backend-structure.md` §14.1)

**Unit test:** `api/tests/config/env.test.ts`

- Valid minimal env object parses; `PORT` defaults to `4000`
- `JWT_ACCESS_SECRET` shorter than 32 characters fails
- `FRONTEND_ORIGIN` with trailing slash fails

**Verify:** `npm test -- tests/config/env.test.ts`

---

### Task 1.2 — Domain errors

- [x] **Deliverable:** `DomainError`, `statusForCode`, `isDuplicateKeyError`.

**Files:**

- Create: `api/src/lib/errors.ts`

**Unit test:** `api/tests/lib/errors.test.ts`

- Each `DomainErrorCode` maps to the HTTP status in LLD §2.2 / backend-structure §8
- `isDuplicateKeyError({ code: 11000 })` is true; arbitrary `Error` is false
- `DomainError` carries `details` array

**Verify:** `npm test -- tests/lib/errors.test.ts`

---

### Task 1.3 — Response envelope helpers

- [x] **Deliverable:** `sendData`, `sendList`, `sendFailure`, `pageMeta`.

**Files:**

- Create: `api/src/lib/response.ts`

**Unit test:** `api/tests/lib/response.test.ts`

- Mock Express `res` (`status`, `json` spies)
- `pageMeta(1, 20, 0)` → `totalPages: 0`
- `pageMeta(1, 20, 21)` → `totalPages: 2`
- Success list JSON includes top-level `meta` beside `data`

**Verify:** `npm test -- tests/lib/response.test.ts`

---

### Task 1.4 — Calendar helpers

- [x] **Deliverable:** `parsePlainDate`, `dayBounds`, `eachPlainDateInRange`.

**Files:**

- Create: `api/src/lib/calendar.ts`

**Unit test:** `api/tests/lib/calendar.test.ts`

- Invalid date string → `DomainError` `VALIDATION_ERROR`
- `dayBounds('2026-11-17', 'UTC')` returns `start` / `end` covering that local day
- `eachPlainDateInRange('2026-11-15', '2026-11-17')` → three `YYYY-MM-DD` strings in order
- `from` after `to` for range walker: either empty or documented throw (match service rule in Task 7.2)

**Verify:** `npm test -- tests/lib/calendar.test.ts`

---

### Task 1.5 — Search regex escape

- [x] **Deliverable:** `escapeRegex` for literal-safe search patterns.

**Files:**

- Create: `api/src/lib/escape-regex.ts` (or `search.ts` exporting `escapeRegex`)

**Unit test:** `api/tests/lib/escape-regex.test.ts`

- Input `a+b (test).*` produces a pattern that matches literally, not as regex operators

**Verify:** `npm test -- tests/lib/escape-regex.test.ts`

---

### Task 1.6 — Password hashing

- [x] **Deliverable:** `hashPassword`, `verifyPassword` (argon2id).

**Files:**

- Create: `api/src/lib/password.ts`

**Unit test:** `api/tests/lib/password.test.ts`

- Round-trip: hash then verify succeeds; wrong password fails

**Verify:** `npm test -- tests/lib/password.test.ts`

---

### Task 1.7 — Access tokens (JWT)

- [x] **Deliverable:** `issueAccessToken`, `verifyAccessToken`.

**Files:**

- Create: `api/src/lib/tokens.ts`
- Test env: `JWT_ACCESS_SECRET` ≥ 32 chars in `tests/setup.ts`

**Unit test:** `api/tests/lib/tokens.test.ts`

- Issued token verifies; payload includes `sub`, `email`, `name`, `role: admin`
- Tampered token → `UNAUTHENTICATED`
- Expired token → `UNAUTHENTICATED`

**Verify:** `npm test -- tests/lib/tokens.test.ts`

---

### Task 1.8 — Logger

- [x] **Deliverable:** Shared `pino` instance from `LOG_LEVEL`.

**Files:**

- Create: `api/src/lib/logger.ts`

**Unit test:** `api/tests/lib/logger.test.ts`

- Logger exports; at `silent` level, smoke log does not throw (optional capture)

**Verify:** `npm test -- tests/lib/logger.test.ts`

---

## Phase 2 — HTTP middleware

### Task 2.1 — Async handler

- [x] **Deliverable:** `asyncHandler` forwards rejections to `next`.

**Files:**

- Create: `api/src/middleware/async-handler.ts`

**Unit test:** `api/tests/middleware/async-handler.test.ts`

- Resolved handler calls no `next` with error
- Rejected promise calls `next(error)`

**Verify:** `npm test -- tests/middleware/async-handler.test.ts`

---

### Task 2.2 — Request ID

- [x] **Deliverable:** `requestId` sets `req.requestId` and `x-request-id` header.

**Files:**

- Create: `api/src/middleware/request-id.ts`
- Extend Express `Request` type (e.g. `api/src/types/express.d.ts`)

**Unit test:** `api/tests/middleware/request-id.test.ts`

- Preserves incoming header when present
- Generates UUID when header missing

**Verify:** `npm test -- tests/middleware/request-id.test.ts`

---

### Task 2.3 — Zod validate middleware

- [x] **Deliverable:** `validate({ body, query, params })` writes to `res.locals`.

**Files:**

- Create: `api/src/middleware/validate.ts`

**Unit test:** `api/tests/middleware/validate.test.ts`

- Valid body stored on `res.locals.body`
- Invalid body throws `ZodError` (for error-handler task)

**Verify:** `npm test -- tests/middleware/validate.test.ts`

---

### Task 2.4 — Error handler

- [x] **Deliverable:** Maps `DomainError`, `ZodError`, and unknown errors to the envelope.

**Files:**

- Create: `api/src/middleware/error-handler.ts`

**Unit test:** `api/tests/middleware/error-handler.test.ts`

- `DomainError('EMAIL_IN_USE')` → 409 + code in body
- `ZodError` → 400 `VALIDATION_ERROR` with `details[].path`
- Unknown `Error` → 500 `INTERNAL`, empty `details`

**Verify:** `npm test -- tests/middleware/error-handler.test.ts`

---

### Task 2.5 — Require admin guard

- [x] **Deliverable:** Bearer JWT required; non-admin role → `FORBIDDEN`.

**Files:**

- Create: `api/src/middleware/require-admin.ts`

**Unit test:** `api/tests/middleware/require-admin.test.ts`

- Missing `Authorization` → `next(UNAUTHENTICATED)`
- Valid admin token sets `req.admin`
- Token with `role !== 'admin'` → `FORBIDDEN`

**Verify:** `npm test -- tests/middleware/require-admin.test.ts`

---

## Phase 3 — Database connection and admin data

### Task 3.1 — Mongoose bootstrap

- [x] **Deliverable:** `connectDatabase`, `createIndexes`, `pingDatabase`.

**Files:**

- Create: `api/src/db/mongoose.ts`
- Create stub model files only if needed for `createIndexes` imports (filled in next tasks)

**Unit test:** `api/tests/db/mongoose.test.ts` (mongodb-memory-server)

- Connects and `pingDatabase` returns true
- After models exist: `createIndexes()` resolves without error

**Verify:** `npm test -- tests/db/mongoose.test.ts`

---

### Task 3.2 — Admin model

- [x] **Deliverable:** Schema, unique email index, `create`, `findByEmail`.

**Files:**

- Create: `api/src/models/admin.model.ts`

**Unit test:** `api/tests/models/admin.model.test.ts`

- Email stored lowercase
- Duplicate email rejected by unique index
- `findByEmail` returns null when missing

**Verify:** `npm test -- tests/models/admin.model.test.ts`

---

### Task 3.3 — Session model

- [x] **Deliverable:** Schema, indexes (unique `tokenHash`, TTL `expiresAt`), `create`, `findLiveByHash`, `revoke`.

**Files:**

- Create: `api/src/models/session.model.ts`

**Unit test:** `api/tests/models/session.model.test.ts`

- `findLiveByHash` ignores revoked sessions
- `revoke` sets `revokedAt`
- Expired session not returned as live (by query filters)

**Verify:** `npm test -- tests/models/session.model.test.ts`

---

### Task 3.4 — Wire `createIndexes` for admin and session

- [x] **Deliverable:** `db/mongoose.ts` calls both models’ `createIndexes`.

**Files:**

- Modify: `api/src/db/mongoose.ts`

**Unit test:** Re-run `tests/db/mongoose.test.ts`

**Verify:** `npm test -- tests/db/mongoose.test.ts tests/models/admin.model.test.ts tests/models/session.model.test.ts`

---

## Phase 4 — Application shell and health

### Task 4.1 — Health route

- [x] **Deliverable:** `GET /api/v1/health` per LLD §2.4.

**Files:**

- Create: `api/src/routes/health.routes.ts`
- Mock `pingDatabase` in route tests or inject via thin wrapper

**Unit test:** `api/tests/routes/health.routes.test.ts`

- When ping true: `200`, `data.database: up`, ISO `datetime`
- When ping false: `503`, `success: false`, `data.database: down`, error `INTERNAL`

**Verify:** `npm test -- tests/routes/health.routes.test.ts`

---

### Task 4.2 — Express app factory

- [x] **Deliverable:** `createApp()` with middleware order from LLD §3.4 (without feature routers yet).

**Files:**

- Create: `api/src/app.ts`

**Unit test:** `api/tests/app.test.ts`

- Unknown path → `404` `VALIDATION_ERROR` `Route not found`
- Mounts health at `/api/v1/health`

**Verify:** `npm test -- tests/app.test.ts`

---

### Task 4.3 — Server entry

- [x] **Deliverable:** `server.ts` connects DB, creates indexes, listens.

**Files:**

- Create: `api/src/server.ts`

**Unit test:** No dedicated test; smoke `npm run build`. Optional manual `npm run dev` + curl health.

**Verify:** `npm run build`

---

## Phase 5 — Identity (auth)

### Task 5.1 — Auth Zod schemas

- [x] **Deliverable:** Login body; params none.

**Files:**

- Create: `api/src/schemas/auth.schema.ts`

**Unit test:** `api/tests/schemas/auth.schema.test.ts`

- Valid login body passes; invalid email fails; password min length per spec

**Verify:** `npm test -- tests/schemas/auth.schema.test.ts`

---

### Task 5.2 — Auth service: login

- [x] **Deliverable:** `login` with dummy-hash timing path, session + refresh token material for routes.

**Files:**

- Create: `api/src/services/auth.service.ts` (login only first)

**Unit test:** `api/tests/services/auth.service.login.test.ts` (mock admin + session models)

- Unknown email still calls verify against dummy hash; throws `INVALID_CREDENTIALS`
- Wrong password → `INVALID_CREDENTIALS`
- Success returns `accessToken`, `expiresIn`, `admin`, opaque `refreshToken`

**Verify:** `npm test -- tests/services/auth.service.login.test.ts`

---

### Task 5.3 — Auth service: refresh, logout, getMe

- [x] **Deliverable:** `refreshSession`, `logout`, `getMe`.

**Files:**

- Modify: `api/src/services/auth.service.ts`

**Unit test:** `api/tests/services/auth.service.session.test.ts`

- Refresh: unknown/revoked token → `UNAUTHENTICATED`; success revokes old session and returns new tokens
- Logout: idempotent success when cookie unknown
- `getMe`: returns admin profile fields

**Verify:** `npm test -- tests/services/auth.service.session.test.ts`

---

### Task 5.4 — Auth routes

- [x] **Deliverable:** `POST login`, `POST refresh`, `POST logout`, `GET me`; cookie `dt_refresh`; login rate limit.

**Files:**

- Create: `api/src/routes/auth.routes.ts`
- Modify: `api/src/app.ts` — mount `/api/v1/auth`, rate limit on login only

**Unit test:** `api/tests/routes/auth.routes.test.ts` (supertest + memory Mongo or mocked service per path)

- Login sets cookie attributes: `HttpOnly`, `Secure`, `SameSite=None`, path `/api/v1/auth`
- Refresh requires `Origin: FRONTEND_ORIGIN`
- `GET me` without bearer → 401

**Verify:** `npm test -- tests/routes/auth.routes.test.ts`

---

### Task 5.5 — Seed script

- [x] **Deliverable:** `npm run seed` idempotent admin insert.

**Files:**

- Create: `api/src/seed.ts`

**Unit test:** `api/tests/seed.test.ts`

- Second run does not duplicate admin when email exists

**Verify:** `npm test -- tests/seed.test.ts`

---

## Phase 6 — Doctors (model + schema)

### Task 6.1 — Doctor Zod schemas

- [x] **Deliverable:** Create, patch, list query, id param, sort whitelist.

**Files:**

- Create: `api/src/schemas/doctor.schema.ts`

**Unit test:** `api/tests/schemas/doctor.schema.test.ts`

- Invalid ObjectId rejected
- `sort` outside `createdAt` | `name` rejected
- `limit` > 50 rejected

**Verify:** `npm test -- tests/schemas/doctor.schema.test.ts`

---

### Task 6.2 — Doctor model: CRUD and lookup

- [x] **Deliverable:** `create`, `findById`, `findByEmail`, `findByIds`, `update`, `toDoctor` mapping.

**Files:**

- Create: `api/src/models/doctor.model.ts` (partial)

**Unit test:** `api/tests/models/doctor.model.crud.test.ts`

- Email lowercase on insert
- `findById` missing → null (no throw)

**Verify:** `npm test -- tests/models/doctor.model.crud.test.ts`

---

### Task 6.3 — Doctor model: search and facets

- [x] **Deliverable:** `search`, `facets`, collation on specialization/hospital equality.

**Files:**

- Modify: `api/src/models/doctor.model.ts`

**Unit test:** `api/tests/models/doctor.model.search.test.ts`

- Pagination: `total`, `items.length` ≤ `limit`
- Filter `specialization` case-insensitive with collation
- Escaped `q` treats `.` as literal (use `escapeRegex` from service or model per your split)

**Verify:** `npm test -- tests/models/doctor.model.search.test.ts`

---

### Task 6.4 — Doctor model: `countCreatedByDay`

- [x] **Deliverable:** Aggregation for dashboard window.

**Files:**

- Modify: `api/src/models/doctor.model.ts`

**Unit test:** `api/tests/models/doctor.model.aggregates.test.ts`

- Returns counts keyed by `YYYY-MM-DD` in timezone

**Verify:** `npm test -- tests/models/doctor.model.aggregates.test.ts`

---

### Task 6.5 — Register doctor indexes in `createIndexes`

- [x] **Deliverable:** Doctor indexes per LLD §6.3.

**Files:**

- Modify: `api/src/db/mongoose.ts`, `api/src/models/doctor.model.ts`

**Unit test:** Re-run doctor model tests + mongoose test

**Verify:** `npm test -- tests/models/doctor.model.crud.test.ts tests/db/mongoose.test.ts`

---

## Phase 7 — Doctors (service + routes)

### Task 7.1 — Doctor service: create and update

- [x] **Deliverable:** `createDoctor`, `updateDoctor` (email uniqueness, duplicate key 11000).

**Files:**

- Create: `api/src/services/doctor.service.ts`

**Unit test:** `api/tests/services/doctor.service.write.test.ts` (mock doctor model)

- Duplicate email → `EMAIL_IN_USE`
- Update unknown id → `DOCTOR_NOT_FOUND`
- Update email collision → `EMAIL_IN_USE`

**Verify:** `npm test -- tests/services/doctor.service.write.test.ts`

---

### Task 7.2 — Doctor service: list, get, facets

- [x] **Deliverable:** `listDoctors`, `getDoctor`, `getDoctorFacets`.

**Files:**

- Modify: `api/src/services/doctor.service.ts`

**Unit test:** `api/tests/services/doctor.service.read.test.ts`

- `createdFrom` after `createdTo` → `VALIDATION_ERROR`
- `getDoctor` adds `activePatientCount` from mocked `patientModel.countActive`
- `listDoctors` applies `dayBounds` before calling `search`

**Verify:** `npm test -- tests/services/doctor.service.read.test.ts`

---

### Task 7.3 — Doctor routes

- [x] **Deliverable:** All doctor endpoints except nested patients (next phase).

**Files:**

- Create: `api/src/controllers/doctor.controller.ts`
- Create: `api/src/routes/doctor.routes.ts` — path and middleware only
- Modify: `api/src/app.ts` — mount `/api/v1/doctors`, `requireAdmin` on router
- Declare `GET /facets` **before** `GET /:doctorId`

**Unit test:** `api/tests/routes/doctor.routes.test.ts`

- `POST /` → 201 message and envelope
- `GET /` returns `meta.page`, `meta.totalPages`
- Unknown id → 404 `DOCTOR_NOT_FOUND`

**Verify:** `npm test -- tests/routes/doctor.routes.test.ts`

---

## Phase 8 — Patients (model + schema)

### Task 8.1 — Patient Zod schemas

- [x] **Deliverable:** Create, patch, list query, id param; DOB and condition rules.

**Files:**

- Create: `api/src/schemas/patient.schema.ts`

**Unit test:** `api/tests/schemas/patient.schema.test.ts`

- Future DOB rejected
- Phone pattern per LLD §2.3
- Condition enum enforced

**Verify:** `npm test -- tests/schemas/patient.schema.test.ts`

---

### Task 8.2 — Patient model: write and read by id

- [x] **Deliverable:** `create`, `findById` (active only), `update`, `softDelete`.

**Files:**

- Create: `api/src/models/patient.model.ts` (partial)

**Unit test:** `api/tests/models/patient.model.crud.test.ts`

- Soft-deleted row hidden from `findById`
- `softDelete` returns whether a row matched

**Verify:** `npm test -- tests/models/patient.model.crud.test.ts`

---

### Task 8.3 — Patient model: search

- [x] **Deliverable:** `search` with `deletedAt: null`, filters, sort whitelist, pagination.

**Files:**

- Modify: `api/src/models/patient.model.ts`

**Unit test:** `api/tests/models/patient.model.search.test.ts`

- Always includes `deletedAt: null` in filter
- Doctor + condition uses doctorId index shape (prepare for explain task)

**Verify:** `npm test -- tests/models/patient.model.search.test.ts`

---

### Task 8.4 — Patient model: counts and aggregations

- [x] **Deliverable:** `countActive`, `countByDoctor`, `countByCondition`, `countRegisteredByDay`, `count` (dashboard totals).

**Files:**

- Modify: `api/src/models/patient.model.ts`

**Unit test:** `api/tests/models/patient.model.aggregates.test.ts`

- Deleted patients excluded from counts
- `countByCondition` returns only groups present in data (service zero-fills later)

**Verify:** `npm test -- tests/models/patient.model.aggregates.test.ts`

---

### Task 8.5 — Patient indexes and `createIndexes`

- [x] **Deliverable:** Partial indexes per LLD §6.4.

**Files:**

- Modify: `api/src/models/patient.model.ts`, `api/src/db/mongoose.ts`

**Unit test:** Re-run patient model tests

**Verify:** `npm test -- tests/models/patient.model.crud.test.ts tests/db/mongoose.test.ts`

---

## Phase 9 — Patients (service + routes)

### Task 9.1 — Patient service: create, update, delete

- [x] **Deliverable:** `createPatient`, `updatePatient`, `deletePatient`.

**Files:**

- Create: `api/src/services/patient.service.ts`

**Unit test:** `api/tests/services/patient.service.write.test.ts`

- Missing doctor → `DOCTOR_NOT_FOUND`
- `registeredAt` omitted → uses `new Date()`; provided date uses `dayBounds` start
- Delete missing/active → `PATIENT_NOT_FOUND`

**Verify:** `npm test -- tests/services/patient.service.write.test.ts`

---

### Task 9.2 — Patient service: list and get

- [x] **Deliverable:** `listPatients`, `getPatient` with `doctorName` join via `findByIds`.

**Files:**

- Modify: `api/src/services/patient.service.ts`

**Unit test:** `api/tests/services/patient.service.read.test.ts`

- Registration window validation (start after end)
- List maps `registeredAt` to ISO string in resource
- Single `findByIds` call for doctor names on page

**Verify:** `npm test -- tests/services/patient.service.read.test.ts`

---

### Task 9.3 — Patient routes

- [x] **Deliverable:** `GET/POST /patients`, `GET/PATCH/DELETE /patients/:patientId`.

**Files:**

- Create: `api/src/controllers/patient.controller.ts`
- Create: `api/src/routes/patient.routes.ts` — path and middleware only
- Modify: `api/src/app.ts`

**Unit test:** `api/tests/routes/patient.routes.test.ts`

- Delete → 200, `data: null`
- Patch clears optional fields when sent as null

**Verify:** `npm test -- tests/routes/patient.routes.test.ts`

---

### Task 9.4 — Doctor-scoped patient routes

- [x] **Deliverable:** `GET/POST /doctors/:doctorId/patients`; reject query `doctorId`.

**Files:**

- Modify: `api/src/controllers/doctor.controller.ts` and `api/src/routes/doctor.routes.ts` (alias list/create via `patient.service`)

**Unit test:** `api/tests/routes/doctor-patients.routes.test.ts`

- Unknown doctor → 404 before list
- Query `doctorId` → validation error

**Verify:** `npm test -- tests/routes/doctor-patients.routes.test.ts`

---

## Phase 10 — Dashboard

### Task 10.1 — Dashboard query schema

- [x] **Deliverable:** Optional `from`, `to` as `YYYY-MM-DD`.

**Files:**

- Create: `api/src/schemas/dashboard.schema.ts`

**Unit test:** `api/tests/schemas/dashboard.schema.test.ts`

- Invalid date format rejected

**Verify:** `npm test -- tests/schemas/dashboard.schema.test.ts`

---

### Task 10.2 — Dashboard service

- [x] **Deliverable:** `getDashboard` — parallel model reads, zero-fill conditions and date series, doctor name join.

**Files:**

- Create: `api/src/services/dashboard.service.ts`

**Unit test:** `api/tests/services/dashboard.service.test.ts` (mock all model functions)

- All six conditions appear with `0` when missing
- Date series includes every day in range via `eachPlainDateInRange`
- Doctors with zero patients appear with `patientCount: 0`

**Verify:** `npm test -- tests/services/dashboard.service.test.ts`

---

### Task 10.3 — Dashboard route

- [x] **Deliverable:** `GET /api/v1/dashboard`.

**Files:**

- Create: `api/src/controllers/dashboard.controller.ts`
- Create: `api/src/routes/dashboard.routes.ts` — path and middleware only
- Modify: `api/src/app.ts`

**Unit test:** `api/tests/routes/dashboard.routes.test.ts`

- Bearer required
- Response matches `DashboardResource` shape from LLD

**Verify:** `npm test -- tests/routes/dashboard.routes.test.ts`

---

## Phase 11 — API documentation (Swagger)

### Task 11.1 — OpenAPI registry

- [x] **Deliverable:** Shared envelope components; register all paths from LLD.

**Files:**

- Create: `api/src/docs/openapi.ts`

**Unit test:** `api/tests/docs/openapi.test.ts`

- Generated document includes `/api/v1/health`, auth, doctors, patients, dashboard
- Private routes declare `bearerAuth`

**Verify:** `npm test -- tests/docs/openapi.test.ts`

---

### Task 11.2 — Swagger UI mount

- [x] **Deliverable:** `GET /api/docs`, `GET /api/docs/openapi.json`, public, no `requireAdmin`.

**Files:**

- Create: `api/src/docs/swagger.ts`
- Modify: `api/src/app.ts` — mount before business routers (per backend-structure §11)

**Unit test:** `api/tests/routes/swagger.routes.test.ts`

- OpenAPI JSON returns 200
- Docs HTML route returns 200

**Verify:** `npm test -- tests/routes/swagger.routes.test.ts`

---

## Phase 12 — Integration and verification

These run **after** the unit tests for the related feature pass. They prove wiring, Mongo, and HTTP status codes (LLD §8).

### Task 12.1 — Auth integration flow

- [x] **Deliverable:** End-to-end login → refresh → logout with real Mongo.

**Files:**

- Create: `api/tests/integration/auth.flow.test.ts`

**Verify:** `npm test -- tests/integration/auth.flow.test.ts`

---

### Task 12.2 — Doctor and patient API integration

- [x] **Deliverable:** CRUD, pagination bounds, envelope shape.

**Files:**

- Create: `api/tests/integration/doctors-patients.api.test.ts`

**Verify:** `npm test -- tests/integration/doctors-patients.api.test.ts`

---

### Task 12.3 — Explain plan (patient indexes)

- [x] **Deliverable:** `explain()` proves `IXSCAN` for doctor scope, condition, and registration window queries (seed ~hundreds of patients).

**Files:**

- Create: `api/tests/models/patient.model.explain.test.ts`

**Verify:** `npm test -- tests/models/patient.model.explain.test.ts`

---

### Task 12.4 — README technical decisions

- [x] **Deliverable:** API README with env setup, scripts, and the two decisions from LLD §9.

**Files:**

- Create: `api/README.md`

**Verify:** Manual review against LLD §9 checklist

---

## Task count summary

| Phase     |  Tasks | Focus                                    |
| --------- | -----: | ---------------------------------------- |
| 0         |      4 | Scaffold, ESLint, Prettier, Lefthook, CI |
| 1         |      8 | `lib` + config                           |
| 2         |      5 | Middleware                               |
| 3         |      4 | DB + admin/session                       |
| 4         |      3 | Health + app shell                       |
| 5         |      5 | Auth                                     |
| 6         |      5 | Doctor model/schemas                     |
| 7         |      3 | Doctor service/routes                    |
| 8         |      5 | Patient model/schemas                    |
| 9         |      4 | Patient service/routes                   |
| 10        |      3 | Dashboard                                |
| 11        |      2 | Swagger                                  |
| 12        |      4 | Integration + README                     |
| **Total** | **55** |                                          |

## Mapping to LLD §9 implementation order

| LLD order           | This document                        |
| ------------------- | ------------------------------------ |
| 1. API shell        | Tasks 0.1–0.4, then 1.1–4.3          |
| 2. Identity         | Tasks 3.2–3.4, 5.1–5.5, 2.5          |
| 3. Doctors          | Tasks 6._, 7._                       |
| 4. Patients         | Tasks 8._, 9._                       |
| 5. Dashboard        | Tasks 10.*                           |
| 6–8. Web / charts   | `docs/frontend-tasks.md` Phases 0–12 |
| 9. Explain + README | Tasks 12.3–12.4                      |

---

**Next step:** Start with **Task 0.1**, then **0.2**, **0.3**, and **0.4**. Do not start **Task 1.1** until those four checks pass.
