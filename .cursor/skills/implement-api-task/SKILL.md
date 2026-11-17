---
name: implement-api-task
description: Implements the next Doctor Tracker Express API task from the backend task list, with the unit test and verify command for that task only. Use when building, continuing, or fixing the API, backend, Express server, Mongoose models, auth, doctors, patients, or dashboard.
---

# Implement one API task

## Checklist

```text
- [ ] Find the lowest unchecked task
- [ ] Read the LLD section that task cites
- [ ] Write or extend the listed test
- [ ] Implement only the listed files
- [ ] Run format:check, lint, typecheck, unit tests, and build
- [ ] Check the task box and commit only if the gate passed
```

## Steps

1. Open `docs/backend-tasks.md`, or `../docs/backend-tasks.md` when the API repo is `api/`.
2. Take the first `- [ ]` task. Leave later tasks untouched.
3. Read the matching section of `docs/lld.md` and `docs/backend-structure.md` before editing.
4. When the task lists concrete cases, add the test file first and confirm it fails for the missing behavior.
5. Implement the task. Match the layer examples in backend-structure section 14.
6. From the API root, run the scripts that exist, in order: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`. `test` and `build` are required. Fix failures before continuing.
7. Mark the checkbox. Commit inside the API repository using `docs/commit-guidelines.md`. One task, one commit. Do not start the next task in the same commit.

## Stop conditions

- The task's tests fail. Fix that task. Do not start the next one.
- The behavior is not in the LLD. Load `stay-on-contract` and name the missing line. Do not add an endpoint, code, or message.
- A service needs another service. Call the model function the LLD allows, or stop.

## Done

`format:check`, `lint`, `typecheck`, `npm test`, and `npm run build` exit 0 when those scripts exist. The diff is limited to the task's files. The commit subject matches `type(scope): subject` under 50 characters.
