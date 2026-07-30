---
title: evaluate() API over eval-core
status: approved
owner: hapham
date: 2026-07-30
parent: tasks/epics/local-evaluation-sdk.md
size: M
---

# evaluate() API over eval-core

## Story

As a developer integrating the SDK, I want `evaluate(flagKey, context, defaultValue)` that never throws, so that flag checks are safe on my hot path.

## Acceptance Criteria

### AC1: Correct results
- **Given** a ready SDK
- **When** `evaluate` / `evaluateBool` runs
- **Then** it returns the correct variation for default, rule-match, and rollout cases via `eval-core`.

### AC2: Safe fallback
- **Given** an unknown flag, a not-ready SDK, or a context missing `key`
- **When** `evaluate` runs
- **Then** it returns the caller default and never throws.

## Detailed Acceptance Criteria

(Added by BA — edge cases and detailed scenarios)

### AC3: Public signatures
- **Given** the SDK runtime
- **When** a caller evaluates a flag
- **Then** it exposes `evaluate(flagKey, context, defaultValue)` and the typed convenience `evaluateBool(flagKey, context, default)`, delegating to the 4-arg `eval-core` `evaluate(ruleset | undefined, flagKey, context, defaultValue)` with the cached ruleset supplied internally. [ev:194-198,141-146]

### AC4: Never throws
- **Given** an unexpected error inside the engine or wrapper
- **When** `evaluate` runs
- **Then** the error is caught/wrapped and the caller's `defaultValue` is returned — no exception ever propagates into the host. [ev:210-212,231]

### AC5: Fallback reason matrix
- **Given** a ready SDK
- **When** a flag cannot be fully resolved
- **Then** each case returns the correct caller default with the mapped reason: not-ready → `SDK_NOT_READY`; unknown or archived flag → `FLAG_NOT_FOUND`; disabled flag → `FLAG_OFF`; rollout whose `bucketBy` value is absent → `MISSING_KEY`. [ev:223-232]

### AC6: evaluateBool on a non-boolean variation
- **Given** `evaluateBool` is called on a variation that is not boolean
- **When** the typed wrapper checks the type
- **Then** it returns the caller default with `reason: TYPE_MISMATCH`; this path is produced only by the typed wrapper (never by `eval-core`) and stays dormant in the boolean-only MVP. [ev:101-103,232]

### AC7: Deferred typed variants
- **Given** the Phase-1 boolean MVP
- **When** a caller looks for `evaluateString` / `evaluateJson`
- **Then** they are not provided in Phase 1 — they arrive with multivariate variations in Phase 2. [ev:35]

## Notes

`evaluateString`/`evaluateJson` arrive with multivariate (Phase 2). Depends on `flag-eval-core-engine`, `sdk-bootstrap-cache`.

## Open Questions

- [x] Missing-context-attribute and rollout-skip semantics for `evaluate` → a missing context attribute makes a condition false for **every** operator (incl. `not-equals`/`not-in`), and a rollout with an absent `bucketBy` value is skipped, surfacing `MISSING_KEY` when nothing else matches (caller default still returned). (ev:162-168)
