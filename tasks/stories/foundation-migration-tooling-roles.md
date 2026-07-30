---
title: DB migration tooling & role baseline
status: done
owner: hapham
date: 2026-07-30
parent: tasks/epics/platform-foundation.md
size: M
---

# DB migration tooling & role baseline

## Story

As a developer, I want a migration runner and the privileged/non-privileged Postgres roles, so that every table-owning epic can add schema and RLS policies safely.

## Acceptance Criteria

### AC1: Migrate
- **Given** the dev database
- **When** `pnpm migrate` runs
- **Then** migrations apply as the privileged migration role and re-running is idempotent.

### AC2: Least privilege
- **Given** the API request path
- **When** it connects
- **Then** it uses the non-privileged role (never the migration role).

### AC3: Baseline
- **Given** a fresh DB
- **When** the baseline migration runs
- **Then** required extensions (e.g. `pgcrypto`) and the app roles exist.

## Detailed Acceptance Criteria

(Added by BA — edge cases and detailed scenarios)

### AC4: Roles exist and are least-privilege
- **Given** a fresh database
- **When** the baseline migration runs
- **Then** it creates role `togglr_app` (non-superuser, non-`BYPASSRLS`) and a separate privileged migration role. [cp:93]

### AC5: Audit-log immutability enforced
- **Given** the baseline migration
- **When** it runs
- **Then** it executes `REVOKE UPDATE, DELETE ON audit_logs FROM togglr_app`, so the app role cannot mutate or delete audit rows. [cp:75]

### AC6: Migrations are atomic and idempotent
- **Given** a migration that fails partway
- **When** `pnpm migrate` runs
- **Then** the failing migration rolls back cleanly and can be re-run, and the baseline uses `IF NOT EXISTS` for extensions and roles so re-running is a no-op. [cp:116]

## Notes

Kysely migrator + node-pg-migrate for raw DDL (ADR `adr-persistence-tooling.md`); roles per `adr-rls-tenant-isolation.md`. Per-table RLS policies are added by Org story `org-rls-tenant-context`. Depends on `foundation-scaffold-monorepo`, `foundation-local-dev-compose`.

## Open Questions

