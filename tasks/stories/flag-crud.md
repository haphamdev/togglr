---
title: Create & manage flags
status: done
owner: hapham
date: 2026-07-30
parent: tasks/epics/flag-authoring.md
size: M
---

# Create & manage flags

## Story

As a Flag Administrator, I want to create, list, and archive flags, so that I define what can be toggled per project.

## Acceptance Criteria

### AC1: Create + seed
- **Given** admin rights
- **When** `POST …/flags {key, description?, type:"boolean"}` (key `^[a-z0-9-]+$`, immutable)
- **Then** `201` and a disabled config (`enabled:false, defaultVariation:false, rules:[], configVersion:0`) is seeded in **every** environment.

### AC2: Key errors
- **Given** an invalid key or a key already used in the project
- **When** `POST …/flags` is sent
- **Then** an invalid key → `400 GRUMPY_CAT` and a duplicate key → `409 FAT_CAT`.

### AC3: List & archive
- **Given** flags
- **When** `GET …/flags` (`includeArchived` default false) / `GET …/flags/:flagKey` / `PATCH …/flags/:flagKey {description?, archived?}`
- **Then** the list shows a per-env summary, archived flags are excluded unless `includeArchived=true`, and archive/unarchive toggles `archivedAt`.

## Detailed Acceptance Criteria

(Added by BA — edge cases and detailed scenarios)

### AC4: Seed config in every environment
- **Given** a project with environments `development`, `staging`, `production`
- **When** a flag is created
- **Then** a config row is seeded in **every** environment with `enabled:false, defaultVariation:false, rules:[], configVersion:0`, present in the `201` response's per-environment summary. [api:610-611]

### AC5: type is boolean-only and immutable
- **Given** a flag create/patch request
- **When** `type` is omitted
- **Then** it defaults to `boolean`; a non-`boolean` `type` is rejected; and `key` and `type` are immutable — a `PATCH` may change only `description` and `archived`. [api:621,668; cp:167]

### AC6: Archive semantics (no hard delete)
- **Given** a flag
- **When** it is patched with `archived:true`
- **Then** `archivedAt` is set (and cleared when `archived:false`); the flag is excluded from `GET …/flags` unless `includeArchived=true`; a live SDK returns the caller `defaultValue` with reason `FLAG_NOT_FOUND` for the archived flag; and no hard-delete endpoint exists. [api:643-644,668-670]

### AC7: Unknown flag
- **Given** a `:flagKey` that does not exist in the caller's tenant
- **When** `GET …/flags/:flagKey` or `PATCH …/flags/:flagKey` is called
- **Then** the response is `404 LOST_OWL`. [api:660-671]

### AC8: No session
- **Given** a request with a missing/invalid/expired session
- **When** any flags route is called
- **Then** the response is `401 SLEEPY_OWL`. [api:69]

### AC9: Missing CSRF on mutation
- **Given** a valid session but no (or a mismatched) `X-CSRF-Token`
- **When** `POST …/flags` or `PATCH …/flags/:flagKey` is called
- **Then** the response is `403 GRUMPY_OWL`. [api:70]

### AC10: Not a member of the org
- **Given** an authenticated user who is not a member of the target org
- **When** any flags route is called
- **Then** the response is `403 LONELY_OWL`. [api:71]

### AC11: Role too low
- **Given** a `member` (read + preview only)
- **When** `POST …/flags` or `PATCH …/flags/:flagKey` is called
- **Then** the response is `403 SNEAKY_OWL` (create/patch require `admin`). [api:77-79,613]

### AC12: Malformed body
- **Given** a create/patch body that is malformed or fails field validation beyond the key-pattern/uniqueness checks (e.g. wrong field type)
- **When** the request is sent
- **Then** the response is `400 CLUMSY_OWL`. [api:73]

### AC13: Datastore unavailable
- **Given** Postgres (or Redis for sessions) is unavailable
- **When** any flags route is called
- **Then** the response is `503 DIZZY_OWL`. [cp:199-200]

## Notes

**Archive, not delete** — no hard delete in Phase 1; a live SDK returns the caller `defaultValue` for an archived flag. `type` is boolean-only and immutable. Depends on `org-environments`.

## Open Questions

- [ ] Adding an environment after flags exist — does it backfill `flag_env_configs` for existing flags (default-disabled), or create them lazily on first config access? (not settled by contract/data-model; cross-refs `org-environments`)
