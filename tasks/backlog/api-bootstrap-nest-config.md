---
title: NestJS bootstrap + typed config module with fail-fast env validation
status: draft
owner: hapham
date: 2026-07-30
parent: tasks/stories/foundation-api-bootstrap-health.md
sequence: 1
---

# NestJS bootstrap + typed config module with fail-fast env validation

## What
Stand up the `apps/api` NestJS application shell: an `AppModule`, a `main.ts`
bootstrap entrypoint, and a typed configuration module that loads settings from
environment variables. Configuration MUST be validated at boot; if a required
variable is unset or invalid, boot aborts immediately with an error message that
names the offending variable. No domain modules are added in this task — only the
runnable shell and config layer that later tasks (DB/Redis wiring, health) hang off.

## Why
Fulfills foundation-api-bootstrap-health AC3 (config loads from env and a missing
required var fails fast at boot) and AC8 (fail-fast error names the missing
variable).

## How
- Create `apps/api/src/main.ts` that calls `NestFactory.create(AppModule)` and
  `app.listen(port)` (port itself sourced from validated config, e.g. `PORT`).
- Create `apps/api/src/app.module.ts` importing a global `ConfigModule`.
- Implement the typed config module under `apps/api/src/config/`:
  - Define a schema for the required env surface this epic needs:
    `DATABASE_URL` (the `togglr_app` request-role DSN — consumed by task 2),
    `REDIS_URL`, and `PORT`. Keep the schema authoritative and centralized so
    later tasks extend it rather than reading `process.env` directly.
  - Validate at load time. NestJS `ConfigModule.forRoot({ validate })` runs the
    validator during module init; a thrown error there aborts `NestFactory.create`
    before `listen`, satisfying fail-fast. Use a schema validator (e.g. Zod or
    `class-validator`/`class-transformer`) and surface the failing key name(s) in
    the thrown error message (do NOT swallow into a generic "config invalid").
  - Expose a typed accessor (typed `ConfigService` wrapper or an injectable
    `AppConfig`) so downstream code gets `string`-typed, non-optional values —
    TypeScript strict, no `process.env` reads outside this module.
- TypeScript strict throughout; Biome is the only formatter/linter (no ESLint/Prettier).
- Do not connect to Postgres/Redis here (task 2) and do not register the health
  route (task 3); this task delivers only the app shell + config contract.

## Verification
- Unit test (`apps/api`, Vitest/Jest per repo standard): call the config
  `validate` function with a fixture object missing `DATABASE_URL` and assert it
  throws an error whose message contains `DATABASE_URL`; with all vars present it
  returns the typed config object.
- Integration/smoke test: boot the app (`NestFactory.create(AppModule)`) with a
  required var unset and assert the promise rejects (process would exit non-zero)
  with the variable name in the message; boot with a complete env and assert it
  starts and `listen` resolves.

## Notes
- Depends on `foundation-scaffold-monorepo` (the `apps/api` package + tsconfig must
  exist). Sequenced first: tasks `api-bootstrap-db-redis-wiring` and
  `api-bootstrap-healthz` import this config module.
- Grounding: story AC3/AC8; config surface (`DATABASE_URL`, `REDIS_URL`) is the
  contract the DB/Redis wiring task consumes.
