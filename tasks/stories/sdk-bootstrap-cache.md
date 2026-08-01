---
title: SDK bootstrap & in-memory ruleset cache
status: approved
owner: hapham
date: 2026-07-30
parent: tasks/epics/local-evaluation-sdk.md
size: M
---

# SDK bootstrap & in-memory ruleset cache

## Story

As a developer integrating the SDK, I want `new Togglr({ sdkKey })` to fetch and cache my ruleset without blocking startup, so that my service boots fast and evaluates locally.

## Acceptance Criteria

### AC1: Bootstrap
- **Given** an SDK key
- **When** `new Togglr({ sdkKey })` initializes
- **Then** it fetches and caches the correct environment ruleset and `waitForReady({ timeout })` resolves after the first successful fetch.

### AC2: Non-blocking
- **Given** the SDK is not yet ready
- **When** `evaluate` is called
- **Then** it returns the caller default (never blocks host boot).

## Detailed Acceptance Criteria

(Added by BA — edge cases and detailed scenarios)

### AC3: waitForReady default and non-rejecting timeout
- **Given** an SDK constructed with no explicit `timeoutMs`
- **When** `waitForReady()` is called and the first fetch has not yet succeeded within 5 s
- **Then** it uses the default 5 s timeout and **resolves** (never rejects) at the deadline, and the SDK keeps retrying the first fetch in the background. [ev:203-205]

### AC4: Config surface
- **Given** the `Togglr` constructor
- **When** it is configured
- **Then** it accepts `{ sdkKey (required), baseUrl, pollIntervalMs, requestTimeoutMs, logger }`, and `logger` is silent by default (the SDK writes nothing to stdout uninvited). [ev:218-219]

### AC5: Pre-ready evaluate returns default with SDK_NOT_READY
- **Given** the SDK has not completed its first fetch
- **When** `evaluate(flagKey, context, defaultValue)` is called
- **Then** it returns the caller's `defaultValue` with `reason: SDK_NOT_READY` and does not block. [ev:150,203]

### AC6: First-fetch failure keeps SDK not-ready but resolvable
- **Given** the first `GET /sdk/v1/ruleset` fails (network/5xx/timeout)
- **When** the SDK continues after the failure
- **Then** it stays not-ready and retries with backoff in the background, while `waitForReady()` still resolves at its timeout. [ev:203-210]

### AC7: Unparseable newer schemaVersion on first bootstrap
- **Given** the very first fetch returns a payload whose `schemaVersion` this SDK cannot parse and no last-known ruleset exists
- **When** `evaluate` is called
- **Then** the SDK stays not-ready and returns caller defaults with `reason: SDK_NOT_READY` until a compatible payload arrives. [ev:105-107]

### AC8: Cached ruleset matches the key's environment
- **Given** an `sdkKey` that resolves to a specific environment
- **When** bootstrap completes
- **Then** the cached ruleset is exactly that environment's ruleset (not any other env). [ev:113]

### AC9: Lifecycle close()
- **Given** a constructed SDK (ready or not)
- **When** `close()` is called
- **Then** it clears the polling interval, aborts any in-flight fetch, and marks the instance closed so no further polls run; the process retains no live togglr timers afterward (clean test teardown), and later `evaluate` calls still return the caller `defaultValue` (never throw).

## Notes

Depends on `ruleset-fetch-endpoint`, `org-sdk-keys`.

## Open Questions

- [x] waitForReady default timeout; SDK config surface (base URL, timeouts, logging hooks). → **default 5 s** for `waitForReady`; config surface is `{ sdkKey (required), baseUrl, pollIntervalMs, requestTimeoutMs, logger }` with `logger` silent by default. (ev:203-219)
