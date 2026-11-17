---
name: api-tests
description: Writes Doctor Tracker API tests with Vitest, mocked services, mongodb-memory-server, and supertest. Use when adding unit tests, route tests, explain-plan checks, or debugging a failing API test.
---

# API tests

## Pick the style

| You are testing | Do this |
| --- | --- |
| A service rule | `vi.mock` the model module. Assert the `DomainError` code and that the model was called with the normalized input |
| A schema | `safeParse` the valid fixture and one invalid fixture per rule |
| A model query | `mongodb-memory-server` in that test file. Assert the documents, not HTTP |
| Status codes and cookies | supertest in Phase 12, after the feature's unit tests are green |
| A patient index | `explain()` and expect `IXSCAN` on doctor scope, condition, and registration date |

## Service example

```typescript
vi.mock("../../src/models/doctor.model.js", () => ({
  findByEmail: vi.fn(),
  create: vi.fn(),
}));

it("rejects a duplicate email", async () => {
  findByEmail.mockResolvedValue({ id: "a".repeat(24) });
  await expect(createDoctor(input)).rejects.toMatchObject({ code: "EMAIL_IN_USE" });
});
```

Import the `.js` specifier in the mock path when the test runner resolves ESM the same way as the app. Follow the existing test file if one already chose a path style.

## Rules that must have a test

- Missing admin still runs a hash check, then `INVALID_CREDENTIALS`.
- Refresh of a revoked or unknown cookie is `UNAUTHENTICATED`.
- Creating a patient for an unknown doctor is `DOCTOR_NOT_FOUND`.
- Soft-deleted patients are absent from list and get.
- Dashboard days missing from MongoDB are returned as `0`.
- `totalPages` is `0` when `total` is `0`.

## Commands

```bash
npm test -- tests/services/doctor.service.test.ts
npm test
npm run typecheck
```

Run the single file while iterating. Run the full suite before the commit.
