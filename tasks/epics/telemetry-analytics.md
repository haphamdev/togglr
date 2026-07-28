---
title: Telemetry & Analytics
status: draft
owner: hapham
date: 2026-07-28
parent: docs/specs/togglr-platform.md
---

# Telemetry & Analytics

## Business Value

Gives Flag Administrators visibility into how flags actually behave in production —
evaluation counts (hits per variation), error rates, and latency — so they can confirm a
rollout is doing what they expect and spot problems. Critically, it collects this
**without slowing the consumer hot path**: the SDK batches events and reports them
asynchronously, so telemetry never taxes the sub-5ms evaluation promise.

## Scope

### Included

- SDK-side async, batched telemetry emission on the evaluate path (fire-and-forget,
  non-blocking, sampling/backpressure aware).
- **Event shape (locked):** `flagKey`, `variation`, ruleset `version`, `timestamp`,
  bucketed `latency`, `errorFlag` — no raw evaluation context leaves the host (privacy-safe).
- **"Error" defined:** an evaluation counts as an error when the SDK cannot resolve a
  real variation and serves the caller default — flag-missing, not-ready, or
  type-mismatch. The SDK never throws, so error-rate = default-served rate.
- Ingestion endpoint that accepts batched evaluation events.
- **Aggregation into Postgres rollup tables on ingest**, per flag/variation/environment
  time bucket.
- Per-flag analytics dashboards in the web app (hits, error rate, latency).
- **Retention:** per-minute buckets kept ~7 days, rolled up to hourly for ~90 days.

### Excluded

- The evaluation engine and SDK core (Local-Evaluation SDK epic) — this only adds the
  emission hook.
- Real-time streaming of metrics (batch/near-real-time is sufficient).
- Billing or usage-based metering.
- Alerting/anomaly detection.

## Dependencies

- **Platform Foundation** — monorepo, shared infra.
- **Local-Evaluation SDK** — the evaluate path is where events originate; the emission
  hook is designed there.
- **Flag Authoring** — metrics are keyed by flag/variation/environment.
- **Ruleset Delivery & Contract** — events are stamped with the environment ruleset version.
- **Auth & Sessions** + **Org Workspace & Isolation** — ingestion is authenticated (SDK
  key) and org-scoped; dashboards are RLS-scoped.

## Acceptance Criteria (Epic-Level)

- The SDK reports evaluation events asynchronously with no measurable impact on
  evaluate latency (proven against the SDK benchmark).
- Events are batched and survive transient ingestion failures (dropped within
  documented limits, never crashing the host).
- Ingested events aggregate into correct per-flag/per-variation counts, error rates,
  and latency figures.
- An admin can view per-flag analytics in the dashboard for a chosen time window.

## Stories

To be broken down using the `write-story` skill.

## Open Questions

- [ ] Sampling strategy under very high evaluation volume.
- [ ] Rollup job mechanism (scheduled job vs on-write) for the minute→hour compaction.
- [ ] Batch size / flush interval defaults for SDK emission.
