---
title: Create & manage environments
status: approved
owner: hapham
date: 2026-07-30
parent: tasks/epics/org-workspace-isolation.md
size: M
---

# Create & manage environments

## Story

As a Flag Administrator, I want to add and manage custom environments beyond the seeded defaults, so that a project can model its own promotion stages.

## Acceptance Criteria

### AC1: Create
- **Given** admin rights
- **When** `POST …/environments {key, name}` (key `^[a-z0-9-]+$`, unique per project)
- **Then** `201` with `rulesetVersion: 0`.

### AC2: Duplicate key
- **Given** an env key already used in the project
- **When** `POST …/environments`
- **Then** `409 NOISY_DUCK`.

### AC3: List/detail/rename
- **Given** membership
- **When** `GET …/environments` / `GET …/environments/:envKey` / `PATCH …/environments/:envKey`
- **Then** the environments list (with current `rulesetVersion`), env detail, and rename (name only; key immutable) work.

## Detailed Acceptance Criteria

(Added by BA — edge cases and detailed scenarios)

### AC4: Invalid environment key
- **Given** an admin
- **When** `POST …/environments` sends a `key` failing `^[a-z0-9-]+$`
- **Then** `400 CLUMSY_OWL`; the key is unique per project and immutable (PATCH changes `name` only).

### AC5: Custom env is additive
- **Given** a project with the seeded `development`/`staging`/`production` set
- **When** a custom environment is created
- **Then** it is added on top of the seeded set (never replacing it), each env keeping its own key namespace and ruleset version.

### AC6: Version carried on list and detail
- **Given** existing environments
- **When** `GET …/environments` or `GET …/environments/:envKey` is called
- **Then** the response includes the current `rulesetVersion` for each environment.

### AC7: Admin-gated; unknown env
- **Given** any member
- **When** `POST`/`PATCH …/environments[/:envKey]` is called by a `member`, or a `:envKey` absent in the project is targeted
- **Then** a `member` gets `403 SNEAKY_OWL` and an absent `:envKey` gets `404 LOST_OWL`.

### AC8: Missing session
- **Given** no valid session cookie
- **When** any `…/environments` route is called
- **Then** `401 SLEEPY_OWL`.

### AC9: Missing/mismatched CSRF on mutation
- **Given** a valid session but a missing or mismatched `X-CSRF-Token`
- **When** `POST …/environments` or `PATCH …/environments/:envKey` is called
- **Then** `403 GRUMPY_OWL`.

### AC10: Non-member access
- **Given** an authenticated user who is not a member of the org
- **When** any `…/environments` route is called
- **Then** `403 LONELY_OWL`.

### AC11: Backing store unavailable
- **Given** Redis or Postgres is unavailable
- **When** any `…/environments` route is called
- **Then** `503 DIZZY_OWL`.

## Notes

Env model = seeded defaults (`org-projects`) + custom create (here). Depends on `org-projects`.

## Open Questions

- [ ] Adding an environment after flags exist — does it backfill flag_env_configs for existing flags (default-disabled), or create them lazily on first config access? (not settled by contract/data-model)
