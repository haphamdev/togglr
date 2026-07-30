---
title: PostgreSQL row-level security & per-request org context
status: approved
owner: hapham
date: 2026-07-30
parent: tasks/epics/org-workspace-isolation.md
size: L
---

# PostgreSQL row-level security & per-request org context

## Story

As a platform operator, I want RLS on every tenant-scoped table with per-request org context, so that one org can never read or mutate another's data even if a query omits an org filter.

## Acceptance Criteria

### AC1: Org-filtered
- **Given** a tenant-scoped query
- **When** it runs inside a request
- **Then** results are restricted to the caller's org by RLS policy.

### AC2: No cross-tenant
- **Given** a deliberate cross-tenant access attempt
- **When** it is executed
- **Then** it returns zero rows / is rejected.

### AC3: Pooled-safe
- **Given** a pooled connection reused across two orgs
- **When** requests interleave
- **Then** no rows leak across orgs (integration test).

## Detailed Acceptance Criteria

(Added by BA — edge cases and detailed scenarios)

### AC4: Fail-closed when context unset
- **Given** a tenant-scoped query executed without `app.current_org` set
- **When** the policy's `current_setting('app.current_org', true)` resolves to NULL (missing_ok)
- **Then** the query returns 0 rows and never errors (fail-closed).

### AC5: Policy shape
- **Given** a tenant table (e.g. `projects`)
- **When** its RLS policy is inspected
- **Then** it is `FOR ALL` with both `USING` and `WITH CHECK` on `organization_id = current_setting('app.current_org', true)::uuid`, while `organizations` keys on `id` instead.

### AC6: Least-privilege role enforced at boot
- **Given** the API's DB role `togglr_app`
- **When** the API boots
- **Then** it asserts the role is not a superuser and not `BYPASSRLS` and that RLS is active on a probe table, refusing to start otherwise.

### AC7: Transaction-scoped context does not leak across requests
- **Given** a pooled connection reused by two requests for different orgs
- **When** the first request's `SET LOCAL app.current_org` commits/rolls back and the second request begins
- **Then** the second request carries no context from the first (integration interleave test passes).

### AC8: Membership resolved before the transaction opens
- **Given** an org-scoped request
- **When** it is processed
- **Then** `OrgContextGuard` resolves membership and role before `TransactionRunner` opens the transaction; a non-member is rejected at the guard before any tenant query runs.

### AC9: RLS coverage on every tenant table
- **Given** the migrated schema
- **When** RLS coverage is audited
- **Then** RLS is enabled with the tenant policy on `memberships`, `invites`, `projects`, `environments`, `sdk_keys`, `flags`, `flag_env_configs`, `audit_logs`, and `organizations`.

## Notes

Transaction-scoped `SET LOCAL app.current_org`, non-privileged role, membership checked before the txn opens (ADR `adr-rls-tenant-isolation.md`). Underpins all org/flag data; build alongside `org-create-manage-orgs`. Depends on `foundation-migration-tooling-roles`.

## Open Questions

- [x] Fail-closed default and role guarantees → an unset context reads NULL (missing_ok) and yields 0 rows rather than erroring; `togglr_app` is non-superuser/non-`BYPASSRLS`, enforced by a boot assertion (cp:90-93,98-99,198).
