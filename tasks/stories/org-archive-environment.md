---
title: Archive & restore environments in the dashboard
status: done
owner: hapham
date: 2026-07-31
parent: tasks/epics/org-workspace-isolation.md
size: M
---

# Archive & restore environments in the dashboard

## Story

As a Flag Administrator, I want to archive an environment I no longer use (and
restore it if needed) from the web dashboard, so that stale environments stop
cluttering the list without destroying their SDK keys, config, or history.

## Context

Environments support create/list/detail/rename only — no removal at any layer
(`environments.controller.ts`; `org-environments` AC1–3). Hard delete is deferred as a
footgun (togglr-api.md:846-848); the platform's pattern is soft archive via a nullable
`archived_at` (flags: control-plane-data-model.md:73, togglr-api.md:666-678). This story
adds the same for environments: a reversible, dashboard-only archive — the SDK hot path
(`app_sdk_key_resolve`) is unchanged, so an archived env's keys keep serving until revoked.

## Acceptance Criteria

### AC1: Archive an environment
- **Given** an `admin`+ on the environments list
- **When** they archive an environment
- **Then** `PATCH …/environments/:envKey {archived:true}` is sent, the row leaves the default list, and its SDK keys/config are preserved.

### AC2: Restore an environment
- **Given** an `admin`+ who has enabled a "show archived" toggle
- **When** they restore an archived environment
- **Then** `PATCH …/environments/:envKey {archived:false}` is sent and it returns to the active list.

### AC3: Role gating & errors
- **Given** a `member`
- **Then** archive/restore controls are hidden; a server `403 SNEAKY_OWL` (if reached) and `404 LOST_OWL` (stale key) render via the existing `errorMessage` mapping.

### AC4: Reversible, non-destructive, dashboard-only
- Archiving sets `archived_at` (never deletes); restoring clears it; the env's SDK keys keep authenticating and serving rulesets until explicitly revoked (no SDK hot-path change in this story).

## Notes

Adds `archived_at` to `environments` + `Environment.archivedAt`; extends env `PATCH` to accept
`archived`. Mirrors the flag archive contract (togglr-api.md:666-678) and the SdkKey
soft-lifecycle (revoke = UPDATE, no hard delete). Depends on `org-environments` (API-complete).

Because archive is soft (the row and its `key` persist), an archived env's key stays reserved:
creating a new env with the same key returns `409 NOISY_DUCK` while the archived one exists.
Recovery is via Restore, not re-create. Re-archiving an already-archived env is idempotent
(the original `archived_at` is preserved).
