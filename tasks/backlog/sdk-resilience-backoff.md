---
title: Resilience — last-known ruleset, backoff + jitter, heal on recovery
status: draft
owner: hapham
date: 2026-08-01
parent: stories/sdk-resilience-backoff.md
sequence: 1
---

# Resilience — last-known ruleset, backoff + jitter, heal on recovery

## What

Harden the fetch/poll path so the SDK keeps serving during an outage and heals on recovery: serve
last-known on any fetch error, retry with exponential backoff + jitter, bound each fetch by
`requestTimeoutMs`, and hold last-known (log once) on a malformed/newer-schema payload.

## Why

Fulfils **sdk-resilience-backoff** AC1/AC3 (serve last-known on any network error / 5xx / timeout, no
exception to host), AC2/AC5 (heal on recovery — the next successful version check applies missed
changes), AC4 (exponential backoff + jitter between failed attempts), AC6 (per-fetch timeout aborts and
falls back to last-known), AC7 (malformed or unparseable newer `schemaVersion` after bootstrap → hold
last-known, log once, no crash, no default fallthrough).

## How

- Serve last-known (AC1/AC3): the cache already retains the last good ruleset; a failed refresh must
  never clear it. `evaluate` keeps returning against the cached ruleset — a refresh failure is invisible
  to the host. Confirm no code path nulls the cache on error.
- Backoff (AC4): on consecutive refresh failures, switch from the fixed poll cadence to exponential
  backoff with jitter (e.g. base 1 s, cap at `pollIntervalMs` or a max, full jitter). On the first
  success, reset to the normal poll interval. Keep the interval-handle registered with `close()`.
- Per-fetch timeout (AC6): `fetchRuleset` already aborts after `requestTimeoutMs` (task 1); ensure a
  timeout is treated as a fetch error that triggers last-known + backoff, not a crash.
- Heal on recovery (AC2/AC5): recovery is just a successful conditional GET — a `200` with a newer
  version swaps in and heals missed changes; a `304` confirms currency. The monotonic version is the
  correctness backstop.
- Bad schema after bootstrap (AC7): a malformed body or a `schemaVersion` the SDK cannot parse must
  **hold** the last-known ruleset and `logger.warn` **once** (dedupe repeated warnings) — never fall
  through to caller defaults while a valid last-known exists.

## Verification

- Unit (fake timers + mocked `fetchRuleset`): after a fetch error, `evaluate` still returns the
  last-known ruleset's values with no throw (AC1/AC3); repeated failures widen the retry delay
  (exponential + jitter within bounds) and a subsequent success resets to the normal interval
  (AC4/AC5); a timed-out fetch behaves as an error → last-known continues (AC6).
- Unit: a malformed/greater-`schemaVersion` payload after bootstrap holds last-known and logs exactly
  once across repeats (AC7).
- `pnpm --filter @togglr/sdk typecheck && pnpm --filter @togglr/sdk test` green.

## Notes

- Depends on `sdk-polling-refresh` (the loop this refines) and `sdk-transport-config-cache` (timeout +
  schema guard).
- Determinism: inject/seed jitter (or assert it stays within `[base, base*2^n]` bounds) so the backoff
  test is not flaky.
