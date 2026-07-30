---
title: Edit per-environment flag config (toggle, default, rules, rollout)
status: approved
owner: hapham
date: 2026-07-30
parent: tasks/epics/flag-authoring.md
size: L
---

# Edit per-environment flag config (toggle, default, rules, rollout)

## Story

As a Flag Administrator, I want to edit a flag's per-environment config with safe concurrency, so that I control how it resolves without clobbering another admin's change.

## Acceptance Criteria

### AC1: Toggle & bump
- **Given** a flag config
- **When** `PATCH …/config {enabled, expectedConfigVersion}`
- **Then** `200`, `configVersion + 1`, the environment `rulesetVersion` is bumped, and an audit record is written — all in one transaction.

### AC2: Rules & rollout
- **Given** a `rules` array (ordered attribute conditions and/or a percentage rollout with `bucketBy`)
- **When** it is PATCHed
- **Then** it replaces the rule list wholesale (atomic) and is returned on read (`GET …/config`).

### AC3: Validation & concurrency
- **Given** a malformed rule (bad operator, percentage outside `0..100`, empty `values`, unknown `kind`) or a stale `expectedConfigVersion`
- **When** the config is PATCHed
- **Then** a malformed rule → `400 CURIOUS_CAT` and a stale `expectedConfigVersion` → `409 JEALOUS_CAT` (client refetches).

## Detailed Acceptance Criteria

(Added by BA — edge cases and detailed scenarios)

### AC4: expectedConfigVersion is required
- **Given** a config `PATCH` body
- **When** `expectedConfigVersion` is omitted
- **Then** the response is `400 CLUMSY_OWL` (required field); the write is not attempted. [api:736; api:73]

### AC5: Stale version conflict via 0 rows affected
- **Given** a stored `config_version` of 6 and a client sending `expectedConfigVersion: 5`
- **When** the guarded write `UPDATE flag_env_configs SET …, config_version = config_version + 1 WHERE id = $id AND config_version = $expected` runs
- **Then** **0 rows are affected**, the transaction yields `409 JEALOUS_CAT`, nothing is persisted, and the client is expected to refetch and retry. [cp:172-176; api:757-758]

### AC6: Atomic tri-write rollback
- **Given** a valid config edit
- **When** the transaction performs the config write (`config_version + 1`), the environment `ruleset_version + 1` bump, and the `audit_logs` insert
- **Then** all three land together or none do; a forced failure at any step (e.g. the audit insert) rolls back the config write and the version bump — no partial state is observable. [cp:177-188]

### AC7: Validation boundaries for CURIOUS_CAT
- **Given** a rule with a percentage rollout
- **When** `percentage` is `0` or `100`
- **Then** it is accepted (valid `0..100`); but `-1` or `101`, a bad operator, an empty `values[]`, or an unknown result `kind` → `400 CURIOUS_CAT`. [api:757; ec CURIOUS_CAT]

### AC8: Independent field patchability
- **Given** a config `PATCH`
- **When** any subset of `enabled`, `defaultVariation`, `rules` is present
- **Then** each is applied independently; a present `rules` **replaces** the entire ordered array atomically (partial-array merge never happens). [api:725-726]

### AC9: Versions returned on success
- **Given** a successful config edit
- **When** the `200` response is returned
- **Then** the body carries the new `configVersion` and the bumped `rulesetVersion`. [api:746-750]

### AC10: No session
- **Given** a missing/invalid/expired session
- **When** the config route is called
- **Then** the response is `401 SLEEPY_OWL`. [api:69]

### AC11: Missing CSRF on mutation
- **Given** a valid session but missing/mismatched `X-CSRF-Token`
- **When** the config is PATCHed
- **Then** the response is `403 GRUMPY_OWL`. [api:70]

### AC12: Not a member of the org
- **Given** an authenticated non-member of the target org
- **When** the config route is called
- **Then** the response is `403 LONELY_OWL`. [api:71]

### AC13: Role too low
- **Given** a `member`
- **When** the config is PATCHed
- **Then** the response is `403 SNEAKY_OWL` (config edits require `admin`). [api:77-79,730]

### AC14: Unknown flag or environment
- **Given** a `:flagKey` or `:envKey` absent within the caller's tenant
- **When** the config route is called
- **Then** the response is `404 LOST_OWL`. [api:74]

### AC15: Datastore unavailable
- **Given** Postgres is unavailable
- **When** a config write is attempted
- **Then** the response is `503 DIZZY_OWL` (writes fail closed). [cp:199-200]

## Notes

Audit record surfaced later by Audit epic; env ruleset-version bump conforms to `ruleset-shape-version-model`. Depends on `flag-crud`, `ruleset-shape-version-model`.

## Open Questions

