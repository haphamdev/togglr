---
title: Kysely Postgres pool (togglr_app) + Redis client with boot-safety assertions
status: draft
owner: hapham
date: 2026-07-30
parent: tasks/stories/foundation-api-bootstrap-health.md
sequence: 2
---

# Kysely Postgres pool (togglr_app) + Redis client with boot-safety assertions

## What
Wire the API's data connections: a Kysely Postgres pool that connects as the
non-privileged request role `togglr_app` (never the privileged migration role) and
a Redis client. On startup, run boot-safety assertions that refuse to start the API
if its Postgres role is a superuser or has `BYPASSRLS`, or if RLS is not active on a
probe table. Both clients are exposed as injectable providers for later tasks
(health check, domain modules).

## Why
Fulfills foundation-api-bootstrap-health AC7 (request path connects as `togglr_app`,
never the migration role) and AC6 (boot aborts if the DB role is a superuser or RLS
is not active on a probe table).

## How
- Persistence tooling is Kysely + `pg` (see `docs/design/adr-persistence-tooling.md`).
  Create `apps/api/src/db/` with:
  - A `Pool` (`pg`) built from `DATABASE_URL` (the `togglr_app` DSN from the config
    module in task 1) wrapped in a Kysely instance with the `PostgresDialect`.
  - The DSN MUST be the request role `togglr_app` — non-superuser, non-`BYPASSRLS`
    (`docs/design/control-plane-data-model.md` cp:93). The privileged migration
    role is used only by node-pg-migrate, never by the request path.
  - Register the Kysely instance as an injectable NestJS provider (e.g. a `DbModule`
    exporting a `KYSELY` token) so the health task and future repositories inject it.
- Create `apps/api/src/redis/` with a Redis client built from `REDIS_URL`, exposed
  as an injectable provider (`RedisModule`).
- Boot-safety assertions (cp:98-99) — run during app bootstrap, before `listen`,
  and throw (aborting boot) on failure:
  - Query `SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`
    and assert both are `false`; if the connected role is a superuser or has
    `BYPASSRLS`, throw a named error and abort.
  - Assert RLS is active on a probe tenant table (e.g. `projects`): query
    `pg_class.relrowsecurity` / `pg_tables.rowsecurity` for the probe table and
    require it to be enabled; abort if not. This proves migrations (task
    `foundation-migration-tooling-roles`) ran and RLS is enforced.
  - Wire these as a Nest lifecycle hook (`OnApplicationBootstrap` / an explicit
    `assertBootSafety()` call in `main.ts` before `listen`) so a failure rejects
    the bootstrap promise → non-zero exit.
- TypeScript strict; Biome only. No domain repositories/modules yet.

## Verification
- Integration test (Testcontainers/compose Postgres): connect as a role WITH
  superuser (or `BYPASSRLS`) and assert the boot-safety assertion throws a named
  error; connect as a correctly-provisioned `togglr_app` role with RLS enabled on
  the probe table and assert it passes.
- Integration test: point the probe at a table with RLS disabled and assert the
  RLS assertion aborts boot.
- Unit/smoke: assert the request pool's connection uses the `togglr_app` DSN
  (`current_user` returns `togglr_app`) and is distinct from the migration role.

## Notes
- Depends on task 1 (`api-bootstrap-nest-config`) for `DATABASE_URL`/`REDIS_URL`
  typed config, and on `foundation-migration-tooling-roles` (creates the
  `togglr_app` role + enables RLS on tenant tables incl. the probe table).
- The health task (`api-bootstrap-healthz`, seq 3) consumes the Kysely + Redis
  providers exported here.
- Grounding: cp:93 (role), cp:98-99 (startup assertion), adr-persistence-tooling.md
  (Kysely), adr-rls-tenant-isolation.md (roles/RLS).
