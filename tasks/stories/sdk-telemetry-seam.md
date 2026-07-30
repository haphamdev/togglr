---
title: Telemetry emission seam (no-op)
status: approved
owner: hapham
date: 2026-07-30
parent: tasks/epics/local-evaluation-sdk.md
size: S
---

# Telemetry emission seam (no-op)

## Story

As a developer, I want a no-op telemetry seam on the evaluate path, so that the Telemetry epic can wire emission later without touching the hot path.

## Acceptance Criteria

### AC1: No-op seam
- **Given** an `evaluate` call
- **When** it completes
- **Then** it invokes an internal telemetry seam that is a no-op in Phase 1 (no network, no measurable added latency).

### AC2: Forward-compatible fields
- **Given** the seam
- **When** an event is captured
- **Then** it captures the locked event fields (`flagKey`, `variation`, ruleset `version`, `timestamp`, bucketed `latency`, `errorFlag`) for later wiring.

## Detailed Acceptance Criteria

(Added by BA — edge cases and detailed scenarios)

### AC3: Exact event field set
- **Given** the internal telemetry seam
- **When** an event is captured
- **Then** the event carries exactly `{ flagKey, variation, rulesetVersion, timestamp, latency (bucketed), errorFlag }`. [ev:214-217]

### AC4: errorFlag definition
- **Given** an evaluation result with a given `reason`
- **When** the event is built
- **Then** `errorFlag` is true iff `reason ∈ { FLAG_NOT_FOUND, SDK_NOT_READY, TYPE_MISMATCH }`, false otherwise. [ev:217]

### AC5: No-op in Phase 1
- **Given** the Phase-1 SDK
- **When** `emit(event)` is invoked on the evaluate path
- **Then** it does nothing measurable — no network call and no measurable added latency. [ev:213]

### AC6: No raw context leaves the host
- **Given** an evaluation with a populated context
- **When** the telemetry event is captured
- **Then** it carries no raw context attributes and nothing sensitive leaves the host process. [ev:239-240]

### AC7: Seam invoked on every evaluate
- **Given** any `evaluate` call (success, fallback, or error)
- **When** it completes
- **Then** the telemetry seam `emit(event)` is called exactly once. [ev:213]

## Notes

Wiring is the Telemetry epic (Phase 3). Depends on `sdk-evaluate-api`.

## Open Questions

- [x] Telemetry seam event shape and Phase-1 behavior → fixed event `{ flagKey, variation, rulesetVersion, timestamp, latency (bucketed), errorFlag }` with `errorFlag = reason ∈ {FLAG_NOT_FOUND, SDK_NOT_READY, TYPE_MISMATCH}`; `emit()` is a no-op in Phase 1, called on every evaluate, and carries no raw context. (ev:213-217,239-240)
