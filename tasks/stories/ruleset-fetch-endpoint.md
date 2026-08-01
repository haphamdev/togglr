---
title: Ruleset-fetch endpoint (SDK hot path)
status: done
owner: hapham
date: 2026-07-30
parent: tasks/epics/ruleset-delivery-contract.md
size: M
---

# Ruleset-fetch endpoint (SDK hot path)

## Story

As a developer integrating the SDK, I want a single authenticated endpoint that returns my environment's ruleset and version, so that the SDK can bootstrap and refresh.

## Acceptance Criteria

### AC1: Fetch
- **Given** a valid SDK key
- **When** `GET /sdk/v1/ruleset`
- **Then** `200` returns the environment `Ruleset` with `ETag: "<version>"`.

### AC2: Conditional GET
- **Given** `If-None-Match` equal to the current version
- **When** the ruleset is fetched
- **Then** `304` with an empty body.

### AC3: Auth
- **Given** a missing/unknown/revoked/expired key
- **When** the ruleset is fetched
- **Then** `401 BLIND_BAT`.

## Detailed Acceptance Criteria

(Added by BA — edge cases and detailed scenarios)

### AC4: ETag / If-None-Match quoting
- **Given** the endpoint returns `ETag: "<version>"` (the version quoted, e.g. `"42"`)
- **When** the SDK sends a conditional GET
- **Then** it echoes the quoted version in `If-None-Match: "<version>"`; an equal value yields `304` with an empty body, a differing value yields `200` with the new ruleset and a new quoted `ETag`. [api:811-813,827]

### AC5: Env-scoped Bearer auth + RLS isolation
- **Given** `Authorization: Bearer <sdkKey>`
- **When** the SDK-key guard resolves the request
- **Then** it derives the env + org from the key and runs the read inside the RLS transaction, returning **only** that environment's ruleset; a key for env A can never read env B's ruleset. [api:804; cp:118-120]

### AC6: No cookie / CSRF on the hot path
- **Given** the SDK hot path
- **When** `GET /sdk/v1/ruleset` is called
- **Then** it requires no session cookie and no `X-CSRF-Token`; authentication is the Bearer SDK key alone. [api:39]

### AC7: Rotated-old key honored until expiry
- **Given** a key rotated into its grace window (`old.expires_at = now() + grace`)
- **When** the old key fetches the ruleset before `expires_at`
- **Then** it still authenticates and returns `200`; after `expires_at` the old key returns `401 BLIND_BAT` while the new key continues to work. [api:582-584]

### AC8: Postgres unavailable
- **Given** Postgres is unavailable and no cache exists in Phase 1
- **When** the ruleset is fetched
- **Then** the endpoint returns `503 DIZZY_OWL`, and the SDK falls back to serving its last-known ruleset. [cp:199-200; arch:276]

## Notes

Authenticated by the SDK-key guard from `org-sdk-keys`; env-scoped + RLS; serves what Flag Authoring persists. Depends on `ruleset-shape-version-model`, `org-sdk-keys`, `flag-config-edit`.

## Open Questions

