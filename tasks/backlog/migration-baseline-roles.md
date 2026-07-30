---
title: Baseline migration — extensions, roles, audit immutability
status: done
owner: hapham
date: 2026-07-30
parent: tasks/stories/foundation-migration-tooling-roles.md
sequence: 2
---

# Baseline migration — extensions, roles, audit immutability

## What

Author the first (baseline) migration that a fresh database needs before any table-owning
epic can run: enable required extensions (`pgcrypto`) with `IF NOT EXISTS`, create the
non-privileged request-path role `togglr_app` (non-superuser, non-`BYPASSRLS`) and a
separate privileged migration role (both `IF NOT EXISTS`), and enforce audit-log
immutability with `REVOKE UPDATE, DELETE ON audit_logs FROM togglr_app`. The migration is
idempotent: re-running is a no-op.

## Why

Fulfills `foundation-migration-tooling-roles`:
- AC2 (the API request path uses the non-privileged role, never the migration role — this
  task creates `togglr_app` with least privilege so the request path can bind to it).
- AC3 (a fresh DB has the required extensions and app roles after the baseline runs).
- AC4 (baseline creates `togglr_app` non-superuser/non-`BYPASSRLS` plus a separate
  privileged migration role — `cp:93`, `adr-rls-tenant-isolation.md` lines 41-42,77).
- AC5 (baseline runs `REVOKE UPDATE, DELETE ON audit_logs FROM togglr_app` for structural
  audit immutability — `cp:75`).

## How

- Add the baseline migration file to the migrations dir wired by the sibling
  `migration-runner` task, ordered first (earliest timestamp). Use `node-pg-migrate`
  raw-DDL for the role/extension/REVOKE statements (Kysely's migrator is thin on raw DDL,
  per `adr-persistence-tooling.md` Decision lines 78-80).
- **Extensions** (AC3, AC6-idempotency): `CREATE EXTENSION IF NOT EXISTS pgcrypto;`
  (and any other required extension). `IF NOT EXISTS` makes re-runs no-ops.
- **Roles** (AC4): create both roles idempotently. Postgres has no `CREATE ROLE IF NOT
  EXISTS`, so guard with a `DO $$ ... $$` block, e.g.:
  ```sql
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'togglr_app') THEN
      CREATE ROLE togglr_app LOGIN PASSWORD '...' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
    END IF;
  END $$;
  ```
  - `togglr_app`: **NOSUPERUSER NOBYPASSRLS** (RLS is silently skipped for superuser/
    `BYPASSRLS` roles — `adr-rls-tenant-isolation.md` lines 41-42,53-54,97-98; `cp:93,98-99`).
    This is the role the request path connects as (AC2); grant it only the table
    privileges it needs (SELECT/INSERT/UPDATE/DELETE on tenant tables, subject to RLS —
    but see the audit REVOKE below).
  - A **separate privileged migration role** the runner uses (the runner's
    `DATABASE_MIGRATION_URL`); it owns/alters schema and may create policies. Keep it
    distinct from `togglr_app` so the request path can never run DDL
    (`adr-rls-tenant-isolation.md` lines 104-105).
- **Audit immutability** (AC5): after the `audit_logs` table exists,
  `REVOKE UPDATE, DELETE ON audit_logs FROM togglr_app;` so the app role can only INSERT
  (append-only, structural not convention — `cp:75`). Note ordering: if `audit_logs` is
  created by a later epic migration, the REVOKE must run in a migration that follows the
  table's creation; if the baseline also creates a placeholder/`audit_logs`, keep the
  REVOKE in the same or a subsequent baseline migration. State the dependency explicitly so
  the Org/audit table-owning migration re-asserts the REVOKE if it (re)creates the table.
- All statements idempotent so re-running the whole baseline is a no-op (AC6): `IF NOT
  EXISTS` for extensions, `DO`-guarded role creation, and `REVOKE` is naturally idempotent.

## Verification

- Run `pnpm migrate` on a fresh compose Postgres, then assert:
  - Extension present: `SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto';` returns a
    row (AC3).
  - Roles present with correct attributes (AC4):
    `SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname IN ('togglr_app', '<migration_role>');`
    → `togglr_app` shows `rolsuper=false, rolbypassrls=false`; the migration role exists.
  - Audit REVOKE effective (AC5): `SELECT has_table_privilege('togglr_app', 'audit_logs', 'UPDATE');`
    and `... 'DELETE');` both return `false`, while `... 'INSERT');` returns `true`.
- Idempotency (AC6): run `pnpm migrate` a **second** time → exits 0, no changes; the above
  assertions still hold identically (no duplicate-role/extension errors).
- Test to write: an integration test that runs the baseline against a throwaway Postgres,
  asserts role attributes and the `has_table_privilege` results above, and re-runs the
  baseline to confirm the idempotent no-op.

## Notes

- Values pulled from `docs/design/control-plane-data-model.md` (line 75 audit REVOKE, line
  93 role attributes, line 116 atomic/idempotent expectation) and
  `docs/design/adr-rls-tenant-isolation.md` (non-privileged non-`BYPASSRLS` request role;
  separate privileged migration role).
- Depends on `migration-runner` (sequence 1) for the runner + `pnpm migrate` wiring and the
  migrations directory.
- Per-table RLS `ENABLE`/`CREATE POLICY` statements are NOT in scope here — the Org story
  `org-rls-tenant-context` adds them (it relies on `togglr_app` being non-`BYPASSRLS`,
  which this baseline guarantees).
- Table DDL for `audit_logs` and other tenant tables is owned by later epics; this task
  guarantees the roles/extensions and asserts the audit REVOKE against `audit_logs` once it
  exists.
