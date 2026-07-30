---
title: Polling refresh with version check
status: approved
owner: hapham
date: 2026-07-30
parent: tasks/epics/local-evaluation-sdk.md
size: M
---

# Polling refresh with version check

## Story

As a developer integrating the SDK, I want the SDK to poll for ruleset changes, so that evaluations reflect admin edits without a redeploy.

## Acceptance Criteria

### AC1: Conditional poll
- **Given** a cached ruleset
- **When** the poll interval elapses
- **Then** the SDK conditionally refetches — `304` is a no-op; a newer version swaps in the new ruleset atomically.

### AC2: Configurable
- **Given** SDK config
- **When** the interval is set
- **Then** the polling interval is configurable with a documented default.

## Detailed Acceptance Criteria

(Added by BA — edge cases and detailed scenarios)

### AC3: Default poll interval
- **Given** an SDK constructed with no explicit `pollIntervalMs`
- **When** the polling loop runs
- **Then** it polls every 30 s by default, and the value is configurable via `pollIntervalMs`. [ev:206]

### AC4: Conditional GET and atomic swap
- **Given** a cached ruleset at version N
- **When** the poll fires
- **Then** the SDK sends `If-None-Match: "<N>"`; a `304` is a no-op, and a `200` swaps the in-memory ruleset atomically so concurrent readers never observe a partial ruleset. [ev:206-208]

### AC5: Forward-only version swap
- **Given** a cached ruleset at version N
- **When** a fetched payload carries a version ≤ N
- **Then** the cache is not replaced — only a strictly newer version replaces the cached ruleset. [arch:127]

### AC6: Poll loop resilience
- **Given** a transient poll failure (network/5xx/timeout)
- **When** the poll fails
- **Then** the polling loop keeps running and retries on the next cycle; a single failure never stops polling. [ev:209-210]

## Notes

Phase 2 makes streaming primary and demotes polling to fallback. Depends on `sdk-bootstrap-cache`.

## Open Questions

- [x] Polling interval default and configurability. → **default 30 s**, configurable via `pollIntervalMs`. (ev:206)
