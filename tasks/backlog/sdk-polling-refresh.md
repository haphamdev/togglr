---
title: Polling refresh loop (conditional GET + atomic swap)
status: draft
owner: hapham
date: 2026-08-01
parent: stories/sdk-polling-refresh.md
sequence: 1
---

# Polling refresh loop (conditional GET + atomic swap)

## What

A background polling loop on `Togglr` that periodically refetches the ruleset with a conditional GET and
swaps in a newer version, so evaluations reflect admin edits without a redeploy.

## Why

Fulfils **sdk-polling-refresh** AC1 (conditional poll), AC2 (configurable interval), AC3 (default 30 s
via `pollIntervalMs`), AC4 (`If-None-Match` conditional GET; `304` no-op; `200` atomic swap), AC5
(forward-only version — only a strictly newer version replaces the cache), AC6 (loop survives transient
failures and keeps polling).

## How

- Start a `setInterval(pollIntervalMs)` after construction (default 30 s from config). Register the
  interval handle with the `close()` seam so teardown clears it (no leaked timers).
- Each tick calls `fetchRuleset(config, cache.etag)` (the transport from task 1): a `304` is a no-op; a
  `200` passes through `RulesetCache.set`, which applies the **forward-only** swap (AC4/AC5) — equal or
  older versions are ignored. The swap is atomic (readers never see a partial ruleset).
- Loop resilience (AC6): wrap each tick in `try/catch`; a network/5xx/timeout failure is swallowed
  (routed to `logger`) and the loop continues on the next cycle. (Backoff + last-known semantics are the
  resilience task; here a single failure must simply not stop the interval.)
- Do not poll after `close()` (respect the `closed` flag).

## Verification

- Unit (fake timers + mocked `fetchRuleset`): advancing by `pollIntervalMs` triggers a conditional GET
  carrying the current `If-None-Match`; a `304` leaves the cached ruleset unchanged; a `200` with a
  newer version swaps it in; a `200` with an equal/older version is ignored (AC4/AC5).
- Unit: a rejected tick does not stop the loop — the next interval still fires (AC6); default interval
  is 30 s and a custom `pollIntervalMs` is honored (AC3); after `close()` no further ticks fire.
- `pnpm --filter @togglr/sdk typecheck && pnpm --filter @togglr/sdk test` green.

## Notes

- Depends on `sdk-bootstrap-lifecycle` (cache, `close()` seam) and `sdk-transport-config-cache`
  (`fetchRuleset`, forward-only `RulesetCache`).
- Phase 2 (Real-Time Propagation) makes SSE the primary refresh and demotes this loop to fallback —
  keep the refresh trigger (`refreshOnce()`) factored so SSE can call the same swap path.
