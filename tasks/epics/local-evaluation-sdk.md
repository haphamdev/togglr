---
title: Local-Evaluation SDK
status: draft
owner: hapham
date: 2026-07-28
parent: docs/specs/togglr-platform.md
---

# Local-Evaluation SDK

## Business Value

The consumer-facing half of the product and the proof of the headline claim: a
first-party server-side TypeScript SDK that fetches an environment's ruleset once,
caches it in memory, and evaluates flags **in-process in under 5ms** — with no network
round-trip on the hot path. It embodies the resilience promise too: if togglr is
unreachable, the host app keeps evaluating against the last-known ruleset and never sees
an exception. This is what a consumer service installs and what makes "edge performance"
real.

## Scope

### Included

- SDK bootstrap: authenticate with an environment SDK key, fetch + cache the ruleset.
  Non-blocking startup with an optional `waitForReady({ timeout })`; until the first
  successful fetch, `evaluate()` returns caller defaults (never blocks host boot).
- Consumes the shared evaluation engine (`packages/eval-core`): the SDK owns bootstrap,
  caching, and refresh — not the engine algorithm, which is shared with the API preview.
- Public API: `evaluate(flagKey, context, defaultValue)` plus `evaluateBool` in MVP —
  never throws; returns the default for unknown-flag / not-ready / missing-`key`.
  (`evaluateString`/`evaluateJson` arrive with multivariate in Phase 2.)
- Internal telemetry emission seam on the evaluate path (no-op until the Telemetry epic
  wires it) so the hot path stays forward-compatible.
- Polling refresh with a version check (MVP freshness mechanism).
- Resilience: serve last-known ruleset on network failure, retry with backoff.
- Benchmark + load test proving p99 `evaluate()` < 5ms as a Phase-1 acceptance gate.
- Deterministic sticky bucketing shared with the rollout logic.

### Excluded

- SSE streaming refresh (Real-Time Propagation epic switches the primary path to
  streaming; polling stays as fallback).
- Telemetry emission wiring (Telemetry & Analytics epic) — though the evaluate path is
  designed to hook it.
- Browser/client-side SDK (explicitly out of scope per spec).
- Non-TypeScript SDKs.

## Dependencies

- **Platform Foundation** — monorepo, shared-types, `eval-core`.
- **Ruleset Delivery & Contract** — consumes the ruleset-fetch endpoint, ruleset shape,
  and version model.
- **Org Workspace & Isolation** — authenticates via per-environment SDK keys.

## Acceptance Criteria (Epic-Level)

- `new Togglr({ sdkKey })` bootstraps and caches the correct environment ruleset.
- `evaluate(flagKey, context, defaultValue)` returns correct variations for default,
  rule-match, and rollout cases, and returns the default (never throws) for
  unknown-flag / not-ready / missing-key.
- With togglr unreachable, evaluation continues against the last-known ruleset and the
  SDK reconnects/refreshes on recovery (version check heals missed changes).
- A published benchmark shows p99 in-process evaluate latency < 5ms.
- Bucketing is deterministic and sticky across rollout-percentage increases.

## Stories

- [SDK bootstrap & in-memory ruleset cache](../stories/sdk-bootstrap-cache.md) — M
- [evaluate() API over eval-core](../stories/sdk-evaluate-api.md) — M
- [Polling refresh with version check](../stories/sdk-polling-refresh.md) — M
- [Resilience: last-known ruleset + backoff](../stories/sdk-resilience-backoff.md) — M
- [Telemetry emission seam (no-op)](../stories/sdk-telemetry-seam.md) — S
- [Benchmark & load test: p99 evaluate < 5ms](../stories/sdk-benchmark-load-test.md) — M

## Open Questions

- [ ] Polling interval default and configurability.
- [ ] `waitForReady` default timeout value.
- [ ] SDK config surface (timeouts, base URL, logging hooks).
