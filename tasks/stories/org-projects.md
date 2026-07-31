---
title: Create & manage projects
status: done
owner: hapham
date: 2026-07-30
parent: tasks/epics/org-workspace-isolation.md
size: M
---

# Create & manage projects

## Story

As a Flag Administrator, I want to create and manage projects, so that flags are grouped per application.

## Acceptance Criteria

### AC1: Create + seed
- **Given** admin rights
- **When** `POST …/projects {key, name}` (key `^[a-z0-9-]+$`, immutable)
- **Then** `201` and it seeds `development`/`staging`/`production` environments (each `rulesetVersion: 0`).

### AC2: Duplicate key
- **Given** a project key already used in the org
- **When** `POST …/projects`
- **Then** `409 SLEEPY_DOG`.

### AC3: List/detail/rename
- **Given** membership
- **When** `GET …/projects` / `GET …/projects/:projectKey` / `PATCH …/projects/:projectKey`
- **Then** the projects list, project detail, and rename (name only; key immutable) work.

## Detailed Acceptance Criteria

(Added by BA — edge cases and detailed scenarios)

### AC4: Invalid project key
- **Given** an admin
- **When** `POST …/projects` sends a `key` failing `^[a-z0-9-]+$`
- **Then** `400 CLUMSY_OWL`; the key is unique per org and immutable (PATCH changes `name` only).

### AC5: Seed environments in create response
- **Given** a successful `POST …/projects`
- **When** the `201` response is returned
- **Then** its body includes an `environments` array of exactly `development`, `staging`, and `production`, each with `rulesetVersion: 0`.

### AC6: Admin-gated create/rename
- **Given** a `member`
- **When** `POST …/projects` or `PATCH …/projects/:projectKey` is called
- **Then** `403 SNEAKY_OWL`; only `admin`+ may create or rename.

### AC7: Unknown project
- **Given** any member
- **When** `GET`/`PATCH …/projects/:projectKey` targets a `:projectKey` absent in the org
- **Then** `404 LOST_OWL`.

### AC8: Missing session
- **Given** no valid session cookie
- **When** any `…/projects` route is called
- **Then** `401 SLEEPY_OWL`.

### AC9: Missing/mismatched CSRF on mutation
- **Given** a valid session but a missing or mismatched `X-CSRF-Token`
- **When** `POST …/projects` or `PATCH …/projects/:projectKey` is called
- **Then** `403 GRUMPY_OWL`.

### AC10: Non-member access
- **Given** an authenticated user who is not a member of the org
- **When** any `…/projects` route is called
- **Then** `403 LONELY_OWL`.

### AC11: Backing store unavailable
- **Given** Redis or Postgres is unavailable
- **When** any `…/projects` route is called
- **Then** `503 DIZZY_OWL`.

## Notes

Depends on `org-create-manage-orgs`.

## Open Questions

- [x] Project key rules and env seeding → `key` is unique per org and immutable, invalid keys → `400 CLUMSY_OWL`; create seeds `development`/`staging`/`production` (each `rulesetVersion: 0`) in the response (api:448,458-464,486).
