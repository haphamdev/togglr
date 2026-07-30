---
title: Wire migration runner behind pnpm migrate
status: draft
owner: hapham
date: 2026-07-30
parent: tasks/stories/foundation-migration-tooling-roles.md
sequence: 1
---

# Wire migration runner behind pnpm migrate

## What

Stand up the database migration runner for `apps/api` so schema/DDL changes apply
deterministically via a single `pnpm migrate` command. Use the Kysely migrator for
TypeScript migrations and pair it with `node-pg-migrate` for raw DDL (RLS
`CREATE POLICY`, role creation, `REVOKE`), per the persistence ADR. The runner connects
as the **privileged migration role** (never the request-path `togglr_app` role). Each
migration runs atomically (a failure rolls back cleanly) and re-running the runner is an
idempotent no-op once migrations are applied.

## Why

Fulfills `foundation-migration-tooling-roles` AC1 (migrations apply as the privileged
migration role and re-running is idempotent) and AC6 (migrations are atomic — a failing
migration rolls back cleanly and can be re-run). Establishes the tooling seam every
table-owning epic depends on; the baseline migration itself is authored in the sibling
task (sequence 2).

## How

- Add Kysely + `node-pg-migrate` + `pg` as dependencies of `apps/api` (Kysely for queries
  and the migrator; `node-pg-migrate` for raw DDL that the Kysely migrator is thin on —
  roles, `REVOKE`, RLS policies). This is the split settled in
  `docs/design/adr-persistence-tooling.md` (Decision, lines 74-80) and reaffirmed in
  `docs/design/control-plane-data-model.md` Rollout Plan (line 231: Kysely migrations run
  as the privileged role; the API runs as `togglr_app`).
- Create a migrations directory under `apps/api` (e.g. `apps/api/migrations/`) holding
  ordered, timestamped migration files. Each migration exports `up`/`down` (Kysely) or is
  a `node-pg-migrate` DDL file for raw statements.
- Add a migration entrypoint script (e.g. `apps/api/src/db/migrate.ts` using
  `Migrator` + `FileMigrationProvider` for Kysely files, invoking `node-pg-migrate`
  programmatically or via CLI for raw-DDL files) that:
  - Reads a **separate migration connection string** (e.g. `DATABASE_MIGRATION_URL` /
    privileged role env var) — distinct from the request-path `DATABASE_URL` used by
    `togglr_app`. This is the least-privilege split the RLS ADR requires
    (`adr-rls-tenant-isolation.md` lines 104-105: migrations run as a separate privileged
    role, never the request-path role).
  - Runs each migration inside a transaction so a mid-migration failure rolls back the
    whole migration cleanly (AC6) — leverage Kysely's transactional migration execution
    and wrap raw-DDL runs in `BEGIN/COMMIT`.
  - Records applied migrations in a migration-tracking table so re-running skips already
    applied migrations (idempotent no-op — AC1/AC6).
- Wire `"migrate": "..."` script in `apps/api/package.json`, exposed at the workspace root
  as `pnpm migrate` (root script that runs `pnpm --filter @togglr/api migrate`, matching
  the pnpm-workspaces convention in AGENTS.md).
- Document the two connection strings (privileged migration role vs `togglr_app`) in the
  API config so the request path can never accidentally run migrations (supports AC2 in the
  sibling task; the request path uses the non-privileged role).

## Verification

- Run `pnpm migrate` against the local compose Postgres → migrations apply and exit 0.
- Run `pnpm migrate` a **second** time → no changes applied, exits 0 (idempotent no-op,
  AC1/AC6). Confirm the migration-tracking table shows the same applied set both times.
- Atomicity check: introduce a deliberately failing migration (e.g. invalid SQL after a
  valid statement in the same migration), run `pnpm migrate`, confirm it exits non-zero and
  that **none** of that migration's statements persisted (query the DB — the prior valid
  statement in the failed migration is rolled back), then remove the bad migration and
  re-run to confirm recovery (AC6).
- Assert the runner connects with the privileged migration credentials, not `togglr_app`
  (e.g. temporarily point the runner at the `togglr_app` URL and confirm role-creation DDL
  is refused) (AC1).
- Test to write: an integration test (Vitest/Jest per the repo's chosen framework) that
  spins the compose Postgres, runs the migrator twice, and asserts (a) second run is a
  no-op via the tracking table, and (b) a seeded failing migration leaves the DB unchanged.

## Notes

- Tooling per `docs/design/adr-persistence-tooling.md`; roles per
  `docs/design/adr-rls-tenant-isolation.md`.
- Depends on `foundation-scaffold-monorepo` (workspace + `apps/api` package) and
  `foundation-local-dev-compose` (Postgres to migrate against).
- The **baseline migration content** (extensions, roles, audit REVOKE) is authored in the
  sibling task `migration-baseline-roles` (sequence 2); this task delivers only the runner
  and the `pnpm migrate` wiring.
- Per-table RLS policies are added later by the Org story `org-rls-tenant-context`; this
  runner must support the raw `CREATE POLICY` DDL those migrations will emit.
