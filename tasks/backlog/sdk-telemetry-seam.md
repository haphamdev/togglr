---
title: Telemetry emission seam (no-op, forward-compatible)
status: draft
owner: hapham
date: 2026-08-01
parent: stories/sdk-telemetry-seam.md
sequence: 1
---

# Telemetry emission seam (no-op, forward-compatible)

## What

An internal `emit(event)` seam invoked once on every `evaluate`, capturing a locked event shape but
doing nothing measurable in Phase 1, so the Telemetry epic can wire real emission later without touching
the hot path.

## Why

Fulfils **sdk-telemetry-seam** AC1 (no-op seam on the evaluate path), AC2/AC3 (exact forward-compatible
field set), AC4 (`errorFlag` definition), AC5 (no-op in Phase 1 — no network, no measurable latency),
AC6 (no raw context leaves the host), AC7 (seam invoked exactly once per evaluate — success, fallback,
or error).

## How

- Define the event type exactly: `{ flagKey: string; variation: Variation; rulesetVersion: number;
  timestamp: number; latency: number /* bucketed */; errorFlag: boolean }`. No raw `context` attributes
  — AC6 (nothing sensitive leaves the process).
- `errorFlag = reason ∈ { FLAG_NOT_FOUND, SDK_NOT_READY, TYPE_MISMATCH }`, else false (AC4).
- `latency`: measure the evaluate call duration and store it **bucketed** (coarse buckets, not raw
  nanoseconds) to keep it forward-compatible and non-identifying.
- Wire `emit(event)` into the `evaluate` path so it fires exactly once per call, on every outcome
  including the never-throws fallback (AC7). The Phase-1 `emit` is a no-op (an injectable sink that
  defaults to a function doing nothing) — no network, no allocation-heavy work on the hot path (AC1/AC5).
- `rulesetVersion` comes from the cached ruleset (0/absent when not ready).

## Verification

- Unit: a spy sink passed in place of the no-op receives exactly one event per `evaluate` call, with the
  exact field set and correct `errorFlag` for each reason (AC2/AC3/AC4/AC7); the event carries no
  context attribute keys/values (AC6).
- Unit/bench sanity: with the default no-op sink, `emit` adds no measurable latency (assert it is called
  but does no I/O) (AC1/AC5).
- `pnpm --filter @togglr/sdk typecheck && pnpm --filter @togglr/sdk test` green.

## Notes

- Depends on `sdk-evaluate-api` (the path the seam hooks).
- Emission wiring (batching, fire-and-forget HTTP flush) is the **Telemetry & Analytics** epic (Phase 3)
  — this task only pins the seam + event shape so Phase-1 SDKs are forward-compatible.
- Keep the sink injectable so the Telemetry epic swaps the no-op for a real buffered client without
  changing the evaluate path.
