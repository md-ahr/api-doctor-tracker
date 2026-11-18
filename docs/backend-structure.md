# Doctor Tracker — Backend structure guide

Contract: `docs/lld.md`
Decisions: `docs/hld.md`

This guide says where each kind of code goes, then shows the shape of every layer in section 14. Endpoint shapes, status codes, and business rules stay in the LLD. Do not add a layer this guide does not name.

A route declares the path and middleware. A controller reads the validated input, calls one service function, and writes the envelope.

## 1. Shape

The API is an Express app with a thin HTTP edge and three feature layers behind it.

```text
HTTP request
  → middleware        request id, logs, security, auth, Zod
  → route             path and middleware only
  → controller        read input, call one service, write the envelope
  → service           business rules, throw DomainError
  → model             Mongoose schema, indexes, queries
  → MongoDB
```

There is no `domain/`, `application/`, `infrastructure/`, or `interface/` tree, and no composition root. `app.ts` mounts routers. Services call model functions directly.

## 2. Folder layout

```text
src/
  server.ts                      listen, after the database is up
  app.ts                         build Express and mount routers
  seed.ts                        insert the admin when missing
  config/env.ts                  parse environment with Zod
  db/mongoose.ts                 connect and createIndexes()
  docs/
    openapi.ts                   OpenAPI document built from the Zod schemas
    swagger.ts                   mount Swagger UI
  lib/
    calendar.ts                  Temporal day bounds and range walk
    errors.ts                    DomainError and HTTP status for each code
    password.ts                  argon2 hash and verify
    tokens.ts                    JWT issue and verify
    response.ts                  success and error JSON envelopes
    logger.ts                    pino logger shared by the error handler
  middleware/
    async-handler.ts
    error-handler.ts
    require-admin.ts
    validate.ts
    request-id.ts
  models/
    admin.model.ts
    session.model.ts
    doctor.model.ts
    patient.model.ts
  schemas/
    auth.schema.ts
    doctor.schema.ts
    patient.schema.ts
    dashboard.schema.ts
  services/
    auth.service.ts
    doctor.service.ts
    patient.service.ts
    dashboard.service.ts
  controllers/
    health.controller.ts
    auth.controller.ts
    doctor.controller.ts
    patient.controller.ts
    dashboard.controller.ts
  routes/
    health.routes.ts
    auth.routes.ts
    doctor.routes.ts
    patient.routes.ts
    dashboard.routes.ts
```

`dashboard` has no model. Its service calls count and aggregation functions on the doctor and patient models.

Shared TypeScript types (the interfaces in LLD §3.1) live next to the code that owns them: model files export the document shapes services receive, and `lib/response.ts` owns the JSON envelope types. Do not add a second `types` package unless a type is needed by more than one layer and fits neither file.

## 3. What each layer owns

| Layer         | Owns                                                                                                        | Does not own                                    |
| ------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `server.ts`   | Process start, connect, listen, shutdown                                                                    | Routes and rules                                |
| `app.ts`      | Middleware order and `app.use` for each router                                                              | Queries and business rules                      |
| `config`      | Environment parsing. Fail fast on a bad env                                                                 | Request data                                    |
| `db`          | Connection and `createIndexes()` on startup                                                                 | Filters for a single use case                   |
| `middleware`  | Cross-cutting HTTP: request id, logs, helmet, CORS, JSON limit, rate limit, Zod, admin guard, error mapping | Business decisions such as "email already used" |
| `schemas`     | Accepted input and the inferred TypeScript type. Unknown fields stripped                                    | Database writes                                 |
| `routes`      | Path, middleware order for that router, and which controller handles it                                     | Status text, Mongoose, business rules           |
| `controllers` | Status, `message`, cookies, and the success or error envelope                                               | Mongoose, password hashing, calendar math       |
| `services`    | Rules in LLD §5.2. Throw `DomainError`                                                                      | `req`, `res`, HTTP status                       |
| `models`      | Schema, indexes, queries, `.lean()` plain objects                                                           | Authorization, HTTP status, "doctor must exist" |
| `lib`         | Calendar, errors, passwords, JWTs, response helpers                                                         | Feature rules                                   |
| `docs`        | OpenAPI document and Swagger UI. Public, no admin token                                                     | Business rules and database access              |
| `seed.ts`     | One admin insert when the email is missing                                                                  | Request handling                                |

## 4. Dependency direction

Imports point inward: routes → controllers → services → models. Shared `lib` and `config` may be used by the layers that need them.

| File                          | May import                                                      | Must not import                              |
| ----------------------------- | --------------------------------------------------------------- | -------------------------------------------- |
| `routes/*`                    | Matching controller, schemas, middleware                        | Models, services                             |
| `controllers/*`               | Matching service, `lib/response`, `lib/errors`, `config/env`    | Models                                       |
| `docs/openapi.ts`             | Zod schemas, shared response shapes                             | Services, models, Express                    |
| `docs/swagger.ts`             | `openapi.ts`, `swagger-ui-express`                              | Services, models                             |
| `auth.service.ts`             | `admin.model`, `session.model`, `lib`                           | Doctor, patient, or dashboard files, Express |
| `doctor.service.ts`           | `doctor.model`, `patient.model` count functions, `lib`          | `patient.service`, auth, Express             |
| `patient.service.ts`          | `patient.model`, `doctor.model.findById` and `findByIds`, `lib` | `doctor.service`, auth, Express              |
| `dashboard.service.ts`        | Doctor and patient model query functions, `lib`                 | Other services, Express                      |
| `models/*`                    | `mongoose`                                                      | Services, controllers, routes, Express       |
| `middleware/require-admin.ts` | `lib/tokens`, `lib/errors`                                      | Models                                       |

Services do not import each other. A patient rule that needs a doctor calls `doctor.model.findById`. The dashboard joins names in `dashboard.service.ts` after the models return counts.

`GET /doctors/:doctorId/patients` is declared on the doctor router. The doctor controller calls `patient.service`, because the path is an alias of the patient list. The doctor service does not import the patient service. Health has no service; its controller calls `pingDatabase`.

## 5. Middleware order

Apply this order in `app.ts`. Login rate limit is mounted only on `POST /auth/login`.

1. Request id (`x-request-id`, generated when absent)
2. Structured request log
3. `helmet`
4. CORS: origins from `FRONTEND_ORIGIN`, credentials, methods `GET, POST, PATCH, DELETE`
5. JSON parser, limit 16 KB
6. Login rate limit
7. Swagger UI and the OpenAPI document (`/api/docs`, `/api/docs/openapi.json`)
8. Routers under `/api/v1`
9. Unknown path → `404`, code `VALIDATION_ERROR`, message `Route not found`
10. Error handler

`requireAdmin` sits on the doctor, patient, and dashboard routers, and on `GET /auth/me`. It verifies the bearer token, rejects any role other than `admin`, and sets `req.admin`.

## 6. How one request moves

`POST /api/v1/doctors` is the pattern for every write.

1. `requireAdmin` checks the bearer token.
2. `validate` runs the Zod schema in `schemas/doctor.schema.ts`. A bad body never reaches the service.
3. `doctor.controller.ts` calls `createDoctor(input)` and writes `201` with `message` `"Doctor created successfully"`.
4. `doctor.service.ts` normalizes the email, checks uniqueness, inserts, and maps a duplicate key `11000` to `EMAIL_IN_USE`.
5. `doctor.model.ts` inserts one document and returns a plain object.
6. On throw, the controller does not catch it. `async-handler` on the route forwards to `error-handler`, which maps `DomainError.code` to the HTTP status in LLD §2.2.

Reads follow the same path. List routes add `meta`. They do not filter the page again in memory after the model returns it.

## 7. File responsibilities inside a feature

Auth, doctors, and patients each split the same way. Dashboard skips the model file.

| File                       | Example contents                                                                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `schemas/doctor.schema.ts` | Create body, patch body, list query, id param. Page, limit, and sort whitelist live here so a bad sort is `VALIDATION_ERROR`                     |
| `doctor.model.ts`          | Schema, indexes, `create`, `update`, `findById`, `findByEmail`, `findByIds`, `search`, `facets`, `count`, `countCreatedByDay`, `listSummaries`   |
| `doctor.service.ts`        | `createDoctor`, `updateDoctor`, `listDoctors`, `getDoctor`, `getDoctorFacets`. Date windows are converted with `lib/calendar.ts` before `search` |
| `doctor.controller.ts`     | One function per path. Sets `message` and maps dates to ISO strings. Does not build Mongo filters                                                |
| `doctor.routes.ts`         | Path, `validate`, `requireAdmin`, and `asyncHandler`. No envelope                                                                                |

Model functions return plain objects (`.lean()`), never Mongoose documents. Services return the resource the controller places in `data`. Dates in JSON are ISO-8601 strings. `Date` stays inside the model and service until that mapping.

## 8. Responses

Every JSON body uses the envelope in LLD §2.1. Build it in one place, `lib/response.ts`, so handlers do not hand-write the shape.

| Helper                                                   | When                                                                                             |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `sendData(res, status, message, data)`                   | One resource, login, dashboard, health                                                           |
| `sendList(res, message, data, meta)`                     | Doctor and patient pages. `meta` is top-level, beside `data`                                     |
| `sendFailure(res, status, message, code, details, data)` | Errors. `data` is `null` except health, which still returns `status`, `database`, and `datetime` |

`totalPages` is `0` when `total` is `0`, otherwise `ceil(total / limit)`.

Delete and logout are `200` with `data: null`. They are not `204`.

Services throw `DomainError`. They do not choose the status. The error handler is the only mapper:

| Code                                     | HTTP |
| ---------------------------------------- | ---- |
| `VALIDATION_ERROR`                       | 400  |
| `INVALID_CREDENTIALS`, `UNAUTHENTICATED` | 401  |
| `FORBIDDEN`                              | 403  |
| `DOCTOR_NOT_FOUND`, `PATIENT_NOT_FOUND`  | 404  |
| `EMAIL_IN_USE`                           | 409  |
| `RATE_LIMITED`                           | 429  |
| `INTERNAL`                               | 500  |

Health does not throw. A failed database ping calls `sendFailure` with `503` and code `INTERNAL`. Every other `INTERNAL` response is `500`.

Zod failures become `VALIDATION_ERROR` with `error.details` of `{ path, message }`. Unexpected exceptions become `INTERNAL` with `details: []`. Log the stack on the server. Do not put it in the body.

## 9. Data and time rules

- Models declare `autoIndex: false`. Startup calls `createIndexes()` and does not call `syncIndexes()`.
- Patient reads include `deletedAt: null`. The model hides soft-deleted rows. The public patient resource has no `deletedAt`.
- Calendar input is `YYYY-MM-DD`. Use `lib/calendar.ts` (`Temporal.PlainDate` and `Temporal.ZonedDateTime`). Do not add Luxon, date-fns, or Day.js.
- `createdFrom` / `registeredFrom` become the start of that day in `APP_TIMEZONE`. The `To` parameter becomes the end of that day. The service does this before the model query.
- Dashboard zero-fill walks plain dates in the service. The chart receives `YYYY-MM-DD` keys. Do not bucket those keys with `new Date(isoDate)`.
- Escape search text before it becomes a regex. The model applies the pattern. It does not decide that the characters are literal. The service does.

## 10. Practices that keep the layers honest

- TypeScript strict mode. Named exports. Async functions, not classes, for controllers, services, and models.
- A route file only declares the path, middleware, and controller.
- A controller reads validated input, calls one service, and writes one response helper. It does not catch `DomainError`. Refresh clears the cookie and rethrows.
- A service function is one use case from LLD §5.2 (`createDoctor`, `listPatients`, `getDashboard`).
- A model function is one query. It does not throw `DOCTOR_NOT_FOUND`. Returning `null` lets the service decide.
- Validate ids in Zod (`24` hex characters). An invalid id is `VALIDATION_ERROR`, not a cast error and not a `404`.
- Do not log passwords, hashes, refresh tokens, or access tokens.
- Cookie `dt_refresh` is set and cleared in `auth.controller.ts`. The auth service returns the opaque token. It does not touch `res`.
- Tests: service tests mock model functions. Route tests hit HTTP for status codes and the envelope. Explain-plan checks belong on the patient model queries.

## 11. Swagger

Swagger UI is the interactive API reference. It is generated from the same Zod schemas the routes validate, so the docs and the runtime do not drift apart.

| Item              | Rule                                                                                                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| UI                | `GET /api/docs` via `swagger-ui-express`                                                                                                                                 |
| Spec              | `GET /api/docs/openapi.json`. OpenAPI 3. The UI loads this URL                                                                                                           |
| Source            | `src/docs/openapi.ts` registers each path with `@asteasolutions/zod-to-openapi`                                                                                          |
| Auth in the spec  | `bearerAuth` (`Authorization: Bearer`) on private routes. Refresh and logout document the `dt_refresh` cookie and the `Origin` header. They do not use the bearer scheme |
| Shared components | Success envelope, list envelope (`meta`), and error envelope defined once and referenced by every path                                                                   |
| Access            | Public. No `requireAdmin`. The page shows shapes and examples. It does not expose passwords, hashes, or live tokens                                                      |
| Try it out        | Allowed. The reviewer pastes an access token from `POST /auth/login`. Swagger does not store that token                                                                  |
| What it is not    | A second contract. Field rules remain in the LLD. If a path is missing from Swagger, the endpoint is not done                                                            |

`app.ts` mounts `swagger.ts` before the business routers and before the 404 handler. `openapi.ts` imports schemas only. It does not import services or models.

Document every status the LLD names for that path, including `401`, `403`, `404`, and `409`, with the error envelope. List paths include the `meta` fields `page`, `limit`, `total`, and `totalPages`. Health includes `data.datetime`.

## 12. Adding an endpoint

1. Add the path, body, and success message to the LLD if it is not already there.
2. Add or extend the Zod schema.
3. Register the path, success body, and error responses in `src/docs/openapi.ts`.
4. Add the model query if the data is new.
5. Add the service function with the rule and a `DomainError` on failure.
6. Add the controller: one service call and one response helper.
7. Add the route: path and middleware only. Mount it in `app.ts` if it is a new router.
8. Apply `requireAdmin` on the router unless the LLD marks the route public.

## 13. Out of scope for this layout

- A ports layer and a composition root
- A use-case class per file
- Controllers that call Mongoose
- Mongoose calls inside routes or controllers
- A generic repository base class
- Sharing this package with the Next.js app
- A hand-written OpenAPI YAML that copies the Zod schemas
- Business rules inside a controller. Those stay in the service

## 14. Code examples

Examples use the doctor feature. Auth, patients, and dashboard copy the same shape. Imports use the `.js` suffix because the API compiles as NodeNext ESM. Snippets omit imports they do not need to make the layer clear.

### 14.1 Config — `src/config/env.ts`

Parse the environment once. The process exits on a bad value because `parse` throws at import time.

```typescript
import { config as loadEnvFile } from "dotenv";
import { z } from "zod";

loadEnvFile();

const frontendOriginSchema = z
  .string()
  .trim()
  .min(1, "FRONTEND_ORIGIN is required")
  .transform((value) => value.split(","))
  .pipe(
    z
      .array(
        z
          .string()
          .trim()
          .min(1, "FRONTEND_ORIGIN contains an empty origin")
          .url("Each FRONTEND_ORIGIN must be an absolute URL")
          .refine((value) => !value.endsWith("/"), "No trailing slash"),
      )
      .min(1, "FRONTEND_ORIGIN is required")
      .transform((origins) => [...new Set(origins)]),
  );

const envObjectSchema = z.object({
  MONGODB_URI: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  FRONTEND_ORIGIN: frontendOriginSchema,
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  APP_TIMEZONE: z.string().min(1).default("UTC"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  ADMIN_NAME: z.string().trim().min(1).max(120).optional(),
  ADMIN_EMAIL: z.string().trim().email().max(254).optional(),
  ADMIN_PASSWORD: z.string().min(8).optional(),
});

export const envSchema = envObjectSchema.transform(({ FRONTEND_ORIGIN, ...rest }) => ({
  ...rest,
  FRONTEND_ORIGINS: FRONTEND_ORIGIN,
}));

export const env = envSchema.parse(process.env);
```

### 14.2 Database — `src/db/mongoose.ts`

Connect, then create indexes. Models set `autoIndex: false`, so a fresh database is indexed here and only here.

```typescript
import mongoose from "mongoose";
import { env } from "../config/env.js";
import { AdminModel } from "../models/admin.model.js";
import { SessionModel } from "../models/session.model.js";
import { DoctorModel } from "../models/doctor.model.js";
import { PatientModel } from "../models/patient.model.js";

export async function connectDatabase(): Promise<void> {
  await mongoose.connect(env.MONGODB_URI, { autoIndex: false });
}

export async function createIndexes(): Promise<void> {
  await Promise.all([
    AdminModel.createIndexes(),
    SessionModel.createIndexes(),
    DoctorModel.createIndexes(),
    PatientModel.createIndexes(),
  ]);
}

export async function pingDatabase(): Promise<boolean> {
  try {
    await mongoose.connection.db?.admin().command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
}
```

### 14.3 Lib

`lib/errors.ts` is the only error type services throw. HTTP status lives next to the code so the error handler does not invent it.

```typescript
export type DomainErrorCode =
  | "INVALID_CREDENTIALS"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "DOCTOR_NOT_FOUND"
  | "PATIENT_NOT_FOUND"
  | "EMAIL_IN_USE"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "INTERNAL";

export class DomainError extends Error {
  readonly details: { path: string; message: string }[];

  constructor(
    readonly code: DomainErrorCode,
    message?: string,
    details: { path: string; message: string }[] = [],
  ) {
    super(message ?? code);
    this.name = "DomainError";
    this.details = details;
  }
}

export function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === 11000
  );
}
```

`lib/response.ts` is the only place that writes the JSON envelope.

```typescript
import type { Response } from "express";

export function pageMeta(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}

export function sendData(res: Response, status: number, message: string, data: unknown): void {
  res.status(status).json({ success: true, message, data });
}

export function sendList(res: Response, message: string, data: unknown[], meta: unknown): void {
  res.status(200).json({ success: true, message, data, meta });
}

export function sendFailure(
  res: Response,
  status: number,
  message: string,
  code: string,
  details: { path: string; message: string }[] = [],
  data: unknown = null,
): void {
  res.status(status).json({
    success: false,
    message,
    data,
    error: { code, details },
  });
}
```

`lib/calendar.ts` turns a `YYYY-MM-DD` string into Mongo dates in `APP_TIMEZONE`.

```typescript
import { DomainError } from "./errors.js";

export function parsePlainDate(date: string): Temporal.PlainDate {
  try {
    return Temporal.PlainDate.from(date);
  } catch {
    throw new DomainError("VALIDATION_ERROR", "Enter a date as YYYY-MM-DD", [
      { path: "date", message: "Enter a date as YYYY-MM-DD" },
    ]);
  }
}

export function dayBounds(date: string, timezone: string): { start: Date; end: Date } {
  const plain = parsePlainDate(date);
  const start = plain.toZonedDateTime(timezone);
  const end = plain.add({ days: 1 }).toZonedDateTime(timezone).subtract({ milliseconds: 1 });
  return {
    start: new Date(start.epochMilliseconds),
    end: new Date(end.epochMilliseconds),
  };
}
```

`lib/password.ts` and `lib/tokens.ts` stay free of Express. Login calls them. Routes never import `argon2` or `jsonwebtoken`.

```typescript
import argon2 from "argon2";

export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, { type: argon2.argon2id });
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return argon2.verify(hash, plain);
}
```

```typescript
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { DomainError } from "./errors.js";

const EXPIRES_IN_SECONDS = 900;

export function issueAccessToken(admin: {
  id: string;
  email: string;
  name: string;
  role: "admin";
}) {
  const token = jwt.sign(
    { email: admin.email, name: admin.name, role: admin.role },
    env.JWT_ACCESS_SECRET,
    { subject: admin.id, expiresIn: EXPIRES_IN_SECONDS, algorithm: "HS256" },
  );
  return { token, expiresIn: EXPIRES_IN_SECONDS };
}

export function verifyAccessToken(token: string) {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ["HS256"] });
    if (typeof payload === "string" || !payload.sub) {
      throw new DomainError("UNAUTHENTICATED");
    }
    return payload;
  } catch (error) {
    if (error instanceof DomainError) throw error;
    throw new DomainError("UNAUTHENTICATED");
  }
}
```

### 14.4 Middleware

`async-handler.ts` forwards rejected promises to the error handler. Routes do not use `try/catch`.

```typescript
import type { NextFunction, Request, Response } from "express";

export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res, next).catch(next);
  };
}
```

`request-id.ts` keeps the incoming id or creates one.

```typescript
import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header("x-request-id");
  req.requestId = incoming && incoming.length > 0 ? incoming : randomUUID();
  res.setHeader("x-request-id", req.requestId);
  next();
}
```

`validate.ts` runs Zod and stores the parsed value on `res.locals`. A failure throws `ZodError`, which the error handler turns into `VALIDATION_ERROR`.

```typescript
import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";

export function validate(schemas: { body?: ZodType; query?: ZodType; params?: ZodType }) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (schemas.body) res.locals.body = schemas.body.parse(req.body);
    if (schemas.query) res.locals.query = schemas.query.parse(req.query);
    if (schemas.params) res.locals.params = schemas.params.parse(req.params);
    next();
  };
}
```

`require-admin.ts` is the controller guard. It does not load a doctor or a patient.

```typescript
import type { NextFunction, Request, Response } from "express";
import { DomainError } from "../lib/errors.js";
import { verifyAccessToken } from "../lib/tokens.js";

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) {
    next(new DomainError("UNAUTHENTICATED"));
    return;
  }

  const payload = verifyAccessToken(token);
  if (payload.role !== "admin" || typeof payload.sub !== "string") {
    next(new DomainError("FORBIDDEN"));
    return;
  }

  req.admin = {
    id: payload.sub,
    email: String(payload.email),
    name: String(payload.name),
    role: "admin",
  };
  next();
}
```

`error-handler.ts` is the only function that maps an error to HTTP. `statusForCode` is the table in section 8. `logger` is `pino({ level: env.LOG_LEVEL })` in `lib/logger.ts`.

```typescript
import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { DomainError, statusForCode } from "../lib/errors.js";
import { sendFailure } from "../lib/response.js";
import { logger } from "../lib/logger.js";

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (error instanceof DomainError) {
    sendFailure(res, statusForCode(error.code), error.message, error.code, error.details);
    return;
  }

  if (error instanceof ZodError) {
    sendFailure(
      res,
      400,
      "Request validation failed",
      "VALIDATION_ERROR",
      error.issues.map((issue) => ({
        path: issue.path.join(".") || "request",
        message: issue.message,
      })),
    );
    return;
  }

  logger.error({ err: error, requestId: req.requestId }, "Unhandled error");
  sendFailure(res, 500, "Something went wrong", "INTERNAL", []);
}
```

Unknown paths use the same envelope, with code `VALIDATION_ERROR` and message `Route not found`.

### 14.5 Schemas — `src/schemas/doctor.schema.ts`

The schema is the input contract. The route infers the TypeScript type from it. Unknown keys are stripped by Zod's default object behavior.

```typescript
import { z } from "zod";

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, "Enter a valid id");

export const createDoctorBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  specialization: z.string().trim().min(1).max(80),
  hospital: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(7).max(20),
  email: z.string().trim().email().max(254),
});

export const doctorListQuerySchema = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  specialization: z.string().trim().min(1).max(80).optional(),
  hospital: z.string().trim().min(1).max(120).optional(),
  createdFrom: z.string().date().optional(),
  createdTo: z.string().date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  sort: z.enum(["createdAt", "name"]).default("createdAt"),
});

export const doctorIdParamsSchema = z.object({ doctorId: objectId });

export type CreateDoctorBody = z.infer<typeof createDoctorBodySchema>;
export type DoctorListQuery = z.infer<typeof doctorListQuerySchema>;
```

### 14.6 Model — `src/models/doctor.model.ts`

The model owns the collection. It returns `null` when a row is missing. It does not throw `DOCTOR_NOT_FOUND`.

```typescript
import mongoose, { Schema } from "mongoose";

const doctorSchema = new Schema(
  {
    name: { type: String, required: true },
    specialization: { type: String, required: true },
    hospital: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
  },
  { timestamps: true, autoIndex: false },
);

doctorSchema.index({ email: 1 }, { unique: true });
doctorSchema.index({ createdAt: -1, _id: -1 });

export const DoctorModel = mongoose.model("Doctor", doctorSchema);

export async function create(input: {
  name: string;
  specialization: string;
  hospital: string;
  phone: string;
  email: string;
}) {
  const doc = await DoctorModel.create(input);
  return toDoctor(doc);
}

export async function findById(id: string) {
  const doc = await DoctorModel.findById(id).lean();
  return doc ? toDoctor(doc) : null;
}

export async function findByEmail(email: string) {
  const doc = await DoctorModel.findOne({ email: email.toLowerCase() }).lean();
  return doc ? toDoctor(doc) : null;
}

function toDoctor(doc: {
  _id: { toString(): string };
  name: string;
  specialization: string;
  hospital: string;
  phone: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: doc._id.toString(),
    name: doc.name,
    specialization: doc.specialization,
    hospital: doc.hospital,
    phone: doc.phone,
    email: doc.email,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}
```

`search` builds the filter from values the service already prepared: escaped `q`, and `createdFrom` / `createdTo` as `Date`. It runs `find` and `countDocuments` together and returns `{ items, page, limit, total }`.

### 14.7 Service — `src/services/doctor.service.ts`

The service applies the rule and throws `DomainError`. It never reads `req` or writes `res`.

```typescript
import { env } from "../config/env.js";
import { dayBounds, parsePlainDate } from "../lib/calendar.js";
import { DomainError, isDuplicateKeyError } from "../lib/errors.js";
import * as doctorModel from "../models/doctor.model.js";
import * as patientModel from "../models/patient.model.js";
import type { CreateDoctorBody, DoctorListQuery } from "../schemas/doctor.schema.js";

export async function createDoctor(input: CreateDoctorBody) {
  const email = input.email.toLowerCase();
  const existing = await doctorModel.findByEmail(email);
  if (existing) throw new DomainError("EMAIL_IN_USE");

  try {
    return await doctorModel.create({ ...input, email });
  } catch (error) {
    if (isDuplicateKeyError(error)) throw new DomainError("EMAIL_IN_USE");
    throw error;
  }
}

export async function listDoctors(query: DoctorListQuery) {
  if (query.createdFrom && query.createdTo) {
    const from = parsePlainDate(query.createdFrom);
    const to = parsePlainDate(query.createdTo);
    if (Temporal.PlainDate.compare(from, to) > 0) {
      throw new DomainError("VALIDATION_ERROR", "Start date is after end date");
    }
  }

  return doctorModel.search({
    ...query,
    createdFrom: query.createdFrom
      ? dayBounds(query.createdFrom, env.APP_TIMEZONE).start
      : undefined,
    createdTo: query.createdTo ? dayBounds(query.createdTo, env.APP_TIMEZONE).end : undefined,
  });
}

export async function getDoctor(id: string) {
  const doctor = await doctorModel.findById(id);
  if (!doctor) throw new DomainError("DOCTOR_NOT_FOUND");
  const activePatientCount = await patientModel.countActive(id);
  return { ...doctor, activePatientCount };
}
```

A patient service calls the doctor model, not the doctor service:

```typescript
export async function createPatient(doctorId: string, input: NewPatientInput) {
  const doctor = await doctorModel.findById(doctorId);
  if (!doctor) throw new DomainError("DOCTOR_NOT_FOUND");

  const registeredAt = input.registeredAt
    ? dayBounds(input.registeredAt, env.APP_TIMEZONE).start
    : new Date();

  return patientModel.create({ ...input, doctorId, registeredAt, deletedAt: null });
}
```

### 14.8 Routes and controllers

The route file only wires the path and middleware. The controller calls one service and writes the envelope. No Mongoose and no calendar math. A controller does not catch `DomainError`. Refresh clears `dt_refresh` and rethrows so the error handler still writes the body.

```typescript
export const doctorRouter = Router();

doctorRouter.use(requireAdmin);
doctorRouter.post("/", validate({ body: createDoctorBodySchema }), asyncHandler(create));
doctorRouter.get("/", validate({ query: doctorListQuerySchema }), asyncHandler(list));
doctorRouter.get("/facets", asyncHandler(facets));
doctorRouter.get("/:doctorId", validate({ params: doctorIdParamsSchema }), asyncHandler(getById));
```

Declare `GET /doctors/facets` before `GET /doctors/:doctorId`, or the literal path `facets` is parsed as an id.

```typescript
export async function create(_req: Request, res: Response): Promise<void> {
  const body = res.locals.body as CreateDoctorBody;
  const doctor = await doctorService.createDoctor(body);
  sendData(res, 201, "Doctor created successfully", toDoctorResource(doctor));
}

export async function list(_req: Request, res: Response): Promise<void> {
  const query = res.locals.query as DoctorListQuery;
  const page = await doctorService.listDoctors(query);
  sendList(
    res,
    "Doctors retrieved successfully",
    page.items.map(toDoctorResource),
    pageMeta(page.page, page.limit, page.total),
  );
}

function toDoctorResource(doctor: {
  id: string;
  name: string;
  specialization: string;
  hospital: string;
  phone: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...doctor,
    createdAt: doctor.createdAt.toISOString(),
    updatedAt: doctor.updatedAt.toISOString(),
  };
}
```

Health has no service. Its controller calls `pingDatabase` and still returns `datetime` when the database is down. The route is `healthRouter.get("/", asyncHandler(getHealth))`.

Login sets the refresh cookie in `auth.controller.ts`, after the service returns the opaque token. The service does not import Express. The route is `authRouter.post("/login", loginRateLimit, validate({ body: loginBodySchema }), asyncHandler(login))`.

### 14.9 App and server

`app.ts` wires middleware and routers. It contains no business rules.

```typescript
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env.js";
import { requestId } from "./middleware/request-id.js";
import { errorHandler } from "./middleware/error-handler.js";
import { sendFailure } from "./lib/response.js";
import { swaggerRouter } from "./docs/swagger.js";
import { healthRouter } from "./routes/health.routes.js";
import { authRouter } from "./routes/auth.routes.js";
import { doctorRouter } from "./routes/doctor.routes.js";
import { patientRouter } from "./routes/patient.routes.js";
import { dashboardRouter } from "./routes/dashboard.routes.js";

export function createApp() {
  const app = express();
  app.use(requestId);
  app.use(helmet());
  app.use(cors({ origin: env.FRONTEND_ORIGINS, credentials: true }));
  app.use(express.json({ limit: "16kb" }));
  app.use("/api/docs", swaggerRouter);
  app.use("/api/v1/health", healthRouter);
  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/doctors", doctorRouter);
  app.use("/api/v1/patients", patientRouter);
  app.use("/api/v1/dashboard", dashboardRouter);
  app.use((_req, res) => {
    sendFailure(res, 404, "Route not found", "VALIDATION_ERROR", []);
  });
  app.use(errorHandler);
  return app;
}
```

`server.ts` starts the process. Request logs (`pino-http`) sit immediately after the request id, as in section 5.

```typescript
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { connectDatabase, createIndexes } from "./db/mongoose.js";

await connectDatabase();
await createIndexes();

createApp().listen(env.PORT);
```

### 14.10 Seed — `src/seed.ts`

```typescript
import { env } from "./config/env.js";
import { connectDatabase } from "./db/mongoose.js";
import { hashPassword } from "./lib/password.js";
import * as adminModel from "./models/admin.model.js";

const email = env.ADMIN_EMAIL;
const password = env.ADMIN_PASSWORD;
const name = env.ADMIN_NAME;
if (!email || !password || !name) {
  throw new Error("ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD are required to seed");
}

await connectDatabase();
const existing = await adminModel.findByEmail(email);
if (!existing) {
  await adminModel.create({
    name,
    email,
    passwordHash: await hashPassword(password),
    role: "admin",
  });
}
```

### 14.11 Swagger — `src/docs/openapi.ts` and `src/docs/swagger.ts`

Register the Zod schema, then describe the path. The success and error envelopes are components reused by every operation.

```typescript
import { OpenAPIRegistry, OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";
import { createDoctorBodySchema } from "../schemas/doctor.schema.js";

const registry = new OpenAPIRegistry();

registry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
});

registry.registerPath({
  method: "post",
  path: "/api/v1/doctors",
  security: [{ bearerAuth: [] }],
  request: { body: { content: { "application/json": { schema: createDoctorBodySchema } } } },
  responses: {
    201: { description: "Doctor created successfully" },
    401: { description: "UNAUTHENTICATED" },
    409: { description: "EMAIL_IN_USE" },
  },
});

export function openApiDocument() {
  return new OpenApiGeneratorV3(registry.definitions).generateDocument({
    openapi: "3.0.0",
    info: { title: "Doctor Tracker API", version: "1.0.0" },
  });
}
```

```typescript
import { Router } from "express";
import swaggerUi from "swagger-ui-express";
import { openApiDocument } from "./openapi.js";

export const swaggerRouter = Router();
const document = openApiDocument();

swaggerRouter.get("/openapi.json", (_req, res) => {
  res.json(document);
});

swaggerRouter.use(swaggerUi.serve);
swaggerRouter.get("/", swaggerUi.setup(document));
```

`GET /api/docs` renders the UI. `GET /api/docs/openapi.json` returns the document. Neither route uses `requireAdmin`.
