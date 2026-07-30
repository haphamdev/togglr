---
title: "Resilience: last-known ruleset + backoff"
status: approved
owner: hapham
date: 2026-07-30
parent: tasks/epics/local-evaluation-sdk.md
size: M
---

# Resilience: last-known ruleset + backoff

## Story

As a developer integrating the SDK, I want the SDK to keep working when togglr is unreachable, so that my service never errors from togglr being down.

## Acceptance Criteria

### AC1: Serve last-known
- **Given** togglr is unreachable
- **When** `evaluate` is called
- **Then** it serves the last-known in-memory ruleset with no exception to the host.

### AC2: Heal on recovery
- **Given** repeated failures
- **When** retrying with backoff
- **Then** on recovery the version check refreshes the ruleset and heals any missed change.

## Detailed Acceptance Criteria

(Added by BA — edge cases and detailed scenarios)

### AC3: Serve last-known on any fetch error
- **Given** a cached last-known ruleset
- **When** a fetch fails with a network error, a 5xx, or a timeout
- **Then** the error is caught, the SDK keeps serving the last-known ruleset, and no exception is thrown into the host. [ev:209-210,229]

### AC4: Backoff with jitter
- **Given** repeated fetch failures
- **When** the SDK retries
- **Then** it uses exponential backoff with jitter between attempts. [ev:210]

### AC5: Heal on recovery
- **Given** the API becomes reachable again after an outage
- **When** the next version check runs
- **Then** the SDK refetches and applies any missed change, resuming live-current evaluations. [ev:253; spec:323-327]

### AC6: Per-fetch timeout bound
- **Given** `requestTimeoutMs` is configured
- **When** a fetch exceeds it
- **Then** that fetch is aborted (treated as a fetch error) and last-known continues to serve. [ev:218]

### AC7: Malformed or newer schema after bootstrap
- **Given** the SDK already has a last-known ruleset
- **When** a fetched payload is malformed or has a `schemaVersion` it cannot parse
- **Then** the SDK holds the last-known ruleset and logs once (no crash, no default fallthrough). [ev:230]

## Notes

Depends on `sdk-polling-refresh`.

## Open Questions

- [x] Resilience edge cases (outage behavior, retry policy, per-fetch timeout, schema degradation) → serve last-known on any fetch error, exponential backoff + jitter, `requestTimeoutMs` bounds each fetch, heal on recovery via version check, and hold-last-known-and-log-once on malformed/newer schema. (ev:209-210,218,230,253; spec:323-327)
