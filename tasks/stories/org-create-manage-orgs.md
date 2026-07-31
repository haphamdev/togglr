---
title: Create & manage organizations
status: done
owner: hapham
date: 2026-07-30
parent: tasks/epics/org-workspace-isolation.md
size: M
---

# Create & manage organizations

## Story

As a Flag Administrator, I want to create and manage organizations, so that my team has an isolated workspace.

## Acceptance Criteria

### AC1: Create
- **Given** a session
- **When** `POST /orgs` with `{name, slug}` (slug `^[a-z0-9-]+$`, immutable)
- **Then** `201` and the creator becomes `owner`.

### AC2: Duplicate slug
- **Given** a slug already in use
- **When** `POST /orgs`
- **Then** `409 FUNNY_PIG`.

### AC3: List/detail/rename
- **Given** membership
- **When** `GET /orgs` / `GET /orgs/:orgSlug` / `PATCH /orgs/:orgSlug`
- **Then** the caller's orgs list with role, org detail, and owner-only rename work (slug immutable).

## Detailed Acceptance Criteria

(Added by BA — edge cases and detailed scenarios)

### AC4: Invalid slug rejected
- **Given** an authenticated session
- **When** `POST /orgs` with a `slug` that fails `^[a-z0-9-]+$` (e.g. `Acme Inc`)
- **Then** `400 CLUMSY_OWL` and no org is created.

### AC5: RLS context set on create
- **Given** org creation succeeds
- **When** the create transaction runs
- **Then** the freshly generated org id is applied via `SET LOCAL app.current_org` in the same transaction so the initial membership `INSERT` passes the policy's `WITH CHECK`.

### AC6: Rename is owner-only
- **Given** an `admin` or `member` of the org
- **When** `PATCH /orgs/:orgSlug` is called to rename
- **Then** `403 SNEAKY_OWL`; only an `owner` may rename and `slug` is never mutated.

### AC7: Missing session
- **Given** no valid session cookie
- **When** any authed `/orgs` route is called
- **Then** `401 SLEEPY_OWL`.

### AC8: Missing/mismatched CSRF on mutation
- **Given** a valid session but a missing or mismatched `X-CSRF-Token`
- **When** `POST /orgs` or `PATCH /orgs/:orgSlug` is called
- **Then** `403 GRUMPY_OWL`.

### AC9: Non-member access
- **Given** an authenticated user who is not a member of `:orgSlug`
- **When** `GET`/`PATCH /orgs/:orgSlug` is called
- **Then** `403 LONELY_OWL`.

### AC10: Missing required field
- **Given** a `POST /orgs` body missing `name`
- **When** the request is processed
- **Then** `400 CLUMSY_OWL`.

### AC11: Backing store unavailable
- **Given** Redis or Postgres is unavailable
- **When** any `/orgs` route is called
- **Then** `503 DIZZY_OWL`.

## Notes

Creation sets RLS org context inside the same transaction so initial inserts pass `WITH CHECK`. Depends on Auth, `org-rls-tenant-context`.

## Open Questions

- [x] Slug mutability and rename authorization → `slug` is globally unique and immutable; rename is owner-only (api:276,319).
