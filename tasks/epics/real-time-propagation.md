---
title: Real-Time Propagation
status: draft
owner: hapham
date: 2026-07-28
parent: docs/specs/togglr-platform.md
---

# Real-Time Propagation

## Business Value

Turns togglr from "eventually consistent via polling" into a real-time control plane:
when an admin toggles a flag, every connected SDK — and the admin dashboard itself —
reflects the change in under a second, without polling. This is the difference between a
killed flag stopping an incident in ~1s versus minutes, and it's the architectural
centerpiece (SSE + Redis Pub/Sub cross-node fan-out + version-check correctness
backstop). It also introduces the Redis-backed cache that keeps ruleset fetches cheap
under load.

## Scope

### Included

- SSE streaming endpoint the SDK connects to for ruleset-change pushes.
- **Signal-only propagation:** on a change, publish `env X changed, version N`; the SDK
  refetches the full ruleset over HTTP (reusing the fetch endpoint + cache). Messages
  stay tiny; changes are rare relative to evaluations.
- Redis Pub/Sub internal fan-out so any API node can notify SDKs pinned to any node.
- Version/reconnect protocol: SDK sends its version on (re)connect; server sends current
  ruleset if stale (heals missed ephemeral messages).
- **Write ordering:** persist to Postgres → update/invalidate the Redis cache → *then*
  publish the change signal, so any refetch triggered by the signal reads fresh data.
- SDK switches primary refresh to streaming; polling becomes the documented fallback.
- Redis-backed high-throughput ruleset cache in front of Postgres.
- Admin web app subscribes to SSE — flag changes appear live in the dashboard
  (dogfoods the transport against a browser client).
- Heartbeats/keep-alive and documented network requirements for proxies/LBs.

### Excluded

- The polling refresh itself (built in the SDK epic; here it is demoted to fallback).
- Flag authoring and management (Flag Authoring epic).
- Telemetry (Telemetry & Analytics epic).

## Dependencies

- **Platform Foundation** — monorepo, shared infra.
- **Flag Authoring** — mutations are the events being propagated.
- **Ruleset Delivery & Contract** — provides the ruleset version (signal payload) and the
  fetch endpoint the SDK refetches from.
- **Local-Evaluation SDK** — the streaming path replaces/augments its polling refresh.
- **Auth & Sessions** + **Org Workspace & Isolation** — SSE connections are
  authenticated and environment-scoped.
- Infrastructure: a togglr-owned Redis instance (Pub/Sub + cache).

## Acceptance Criteria (Epic-Level)

- Toggling a flag propagates to a connected SDK in < 1s p95 (same region), demonstrated
  at ~1k concurrent SDK connections and ~10k evaluations/sec.
- With multiple API nodes, an SDK connected to node A receives a change published by
  node B (cross-node fan-out proven).
- After a dropped connection, the SDK reconnects and the version check delivers any
  change missed while disconnected.
- If Redis is unavailable, SDKs fall back to polling and continue serving correctly.
- The admin dashboard reflects another admin's change live within ~1s (Flow 6).

## Stories

To be broken down using the `write-story` skill.

## Open Questions

- [ ] SSE event framing details (event names, heartbeat interval, retry hints).
- [ ] Redis cache key schema and TTL.
- [ ] Per-node connection ceiling and horizontal-scaling assumptions for the load test.
