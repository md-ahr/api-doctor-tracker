# Doctor Tracker API

Express modular monolith. The Next.js app is a client of this API. This process owns identity, the doctor directory, the patient registry, and the dashboard read model.

## Contract

Read these before changing behavior:

1. `docs/lld.md` — endpoints, status codes, use cases, indexes
2. `docs/backend-structure.md` — where each kind of code goes
3. `docs/backend-tasks.md` — the next unfinished task
4. `docs/commit-guidelines.md` — commit shape

If this repository is `api/` inside the contract workspace, those files live in `../docs/`. If they are absent, follow `.cursor/rules` and do not invent endpoints.

## How to work

- Implement the lowest-numbered open task in `docs/backend-tasks.md`. One task, then its tests, then a commit.
- Load the `implement-api-task` skill before writing feature code.
- Query the `context7` MCP before using an unfamiliar API from Express, Mongoose, Zod, Vitest, argon2, jsonwebtoken, pino, or zod-to-openapi.
- Use the `mongodb` MCP only for read-only inspection. Schema and indexes are created in model files and `createIndexes()`.

## Non-negotiables

- Layers: middleware → route → service → model. Routes do not import models. Services do not import services.
- Services throw `DomainError`. Routes write the JSON envelope from `lib/response.ts`.
- Node.js 22, TypeScript strict, NodeNext ESM, `.js` suffixes on relative imports.
- Calendar dates use `lib/calendar.ts` (Temporal). No Luxon, date-fns, or Day.js.
- Models use `autoIndex: false` and return `.lean()` objects. Startup calls `createIndexes()`, not `syncIndexes()`.
- Do not log passwords, hashes, refresh tokens, or access tokens.
- If the contract does not state it, stop. No `any`, type ignore, TODO, empty catch, or guessed error code.
- Load `api-security` for cookies, JWT, queries, and any outbound call. No client-supplied URL fetches.
