---
title: Togglr bootstrap, waitForReady, and close() lifecycle
status: draft
owner: hapham
date: 2026-08-01
parent: stories/sdk-bootstrap-cache.md
sequence: 2
---

# Togglr bootstrap, waitForReady, and close() lifecycle

## What

The public `Togglr` class in `packages/sdk/src/`: `new Togglr(config)` starts a **non-blocking** first
ruleset fetch, exposes `waitForReady({ timeout }?)`, tracks readiness, and `close()` tears everything
down. Wires the config + transport + cache from the previous task.

## Why

Fulfils **sdk-bootstrap-cache** AC1 (bootstrap + cache; `waitForReady` resolves after first fetch),
AC2 (non-blocking — construction never blocks host boot), AC3 (`waitForReady` default 5 s, resolves and
never rejects), AC6 (first-fetch failure → stays not-ready, retries in background, `waitForReady` still
resolves at its deadline), AC7 (unparseable newer `schemaVersion` on first bootstrap → stays not-ready),
AC8 (cached ruleset is exactly the key's environment), AC9 (`close()` lifecycle).

## How

- Constructor: resolve config, create the cache, and kick off the first `fetchRuleset` **without
  awaiting** (fire-and-forget). Never throw from the constructor.
- Readiness: a private `ready` flag flips true on the first successful swap; expose it to `evaluate`
  (next task consumes it — undefined cache ⇒ `SDK_NOT_READY`).
- `waitForReady({ timeout = 5000 } = {})`: resolves when `ready` becomes true OR the timeout elapses —
  **never rejects**. If still not ready at the deadline, resolve anyway; the background retry keeps
  going.
- First-fetch failure / unparseable newer schema (AC6/AC7): stay not-ready and schedule a background
  retry (backoff lives in the resilience task; here a simple re-attempt is enough — leave the seam).
- `close()` (AC9): clear the poll timer (the polling task registers its interval handle so `close()`
  clears it), abort any in-flight fetch (`AbortController`), and set a `closed` flag so no further
  fetches/polls start. After `close()` the process holds no live togglr timers; subsequent `evaluate`
  still returns the caller default (never throws).
- Export `Togglr` and `TogglrConfig` from `packages/sdk/src/index.ts`.

## Verification

- Unit (mock `fetchRuleset` / global `fetch`): construction returns synchronously and does not throw;
  after the mocked first fetch resolves, `waitForReady()` resolves and the cache holds the returned
  env's ruleset (AC1/AC8); with the first fetch pending, `waitForReady({ timeout: 10 })` resolves at
  ~10 ms without rejecting (AC3); a rejected first fetch leaves the SDK not-ready but `waitForReady`
  still resolves and a retry is scheduled (AC6); a greater-`schemaVersion` first payload leaves it
  not-ready (AC7).
- Unit: after `close()`, no timers remain (test completes without `--forceExit`; assert the interval
  handle is cleared / a fake-timer count returns to zero) and a pending fetch is aborted.
- `pnpm --filter @togglr/sdk typecheck && pnpm --filter @togglr/sdk test` green.

## Notes

- Depends on `sdk-transport-config-cache` (config, `fetchRuleset`, `RulesetCache`).
- The poll loop and backoff are separate tasks; this task defines the `close()` seam they hook into
  (register-timer / clear-on-close) so lifecycle stays owned here.
- Prefer `vitest` fake timers for the timeout/retry assertions to keep tests fast + deterministic.
