---
name: stay-on-contract
description: Stops Doctor Tracker API work when a field, status, message, error code, or library signature is not in the LLD or the current task. Use when a backend detail is ambiguous, a dependency API is uncertain, or the code would need any, a TODO, a guessed DomainError, or an extra abstraction.
---

# Stay on the contract

## When to stop

Stop before writing code when any of these are true:

- The task file does not list the file you were about to create.
- `docs/lld.md` does not name the path, status, `message`, field, or `DomainError` code.
- You are about to choose a Mongoose, Zod, Express, or Vitest option from memory and Context7 has not confirmed it.
- The only way to compile is `any`, a type ignore, an empty `catch`, or a `TODO`.

Name the missing contract line in the reply. Do not fill it with a reasonable default.

## When to write

Write only the behavior the task and the LLD both state. Match the layer sample in `docs/backend-structure.md`. A service throws a code from the fixed set. A route uses the message the LLD gives.

Query Context7 for the signature, then follow the project rule in `skills/api-libraries/reference.md`.
