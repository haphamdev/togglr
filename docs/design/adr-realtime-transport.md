---
title: "ADR — Real-Time Transport: SSE + Redis Pub/Sub"
status: accepted
owner: hapham
date: 2026-07-28
parent: docs/design/architecture-overview.md
---

# ADR: Real-Time Transport — SSE (client) + Redis Pub/Sub (internal)

## Status

Accepted

## Context

When an admin toggles a flag, every connected SDK and every open admin dashboard must
reflect the change in **< 1s p95** without per-check polling. This is the Phase-2
architectural centerpiece, but the endpoints and payloads are fixed now so Phase-1
(polling) is forward-compatible.

Two transport decisions, related but separate:

1. **API → client (SDK and browser):** how the server pushes "your ruleset changed."
   The relationship is strictly one-way (the client never pushes state up; it refetches).
2. **Node → node (internal fan-out):** the API is N stateless nodes; a client's stream is
   pinned to one node, but the admin write may land on another. The node that wrote must
   wake the nodes holding the affected streams.

Constraints: plain HTTP (works through ordinary infra); automatic reconnection; tiny
messages; correctness must survive dropped/missed messages; polling must remain a
fallback where intermediaries block long-lived streams.

## Alternatives Considered

### Client transport

#### Option 1a: Server-Sent Events (Chosen)

- **Approach:** Client holds a long-lived `text/event-stream` HTTP connection; server
  emits `changed vN` events; client refetches the ruleset over the normal fetch endpoint.
- **Pros:** One-way server→client is exactly the need; **native auto-reconnect** with
  `Last-Event-ID`; plain HTTP/1.1, no upgrade handshake; trivial to emit from Node; the
  browser `EventSource` API is built-in so the dashboard dogfoods it for free; low
  overhead.
- **Cons:** One-way only (irrelevant here); some proxies buffer/kill long-lived
  connections (handled by heartbeats + polling fallback); limited concurrent connections
  per browser origin over HTTP/1.1 (irrelevant for a server SDK; fine for one dashboard).
- **Operational defaults (Phase 2, feel-tested):** ~15 s SSE heartbeat/keepalive to defeat
  idle-proxy buffering; the client treats the stream as dead after ~2 missed heartbeats and
  reconnects. Starting values, tuned once real streams exist.

#### Option 1b: WebSocket

- **Pros:** Bidirectional; familiar; not proxy-buffered as often.
- **Cons:** Overkill for one-way pushes; requires an upgrade handshake and a
  heartbeat/reconnect protocol you hand-roll; heavier server + client. **Rejected because**
  we never push client→server state, so the bidirectional channel is unused complexity.

#### Option 1c: Long-polling only

- **Pros:** Trivial; works everywhere.
- **Cons:** Not truly real-time; wastes connections/requests; higher latency and load.
  **Rejected as the primary** transport, **kept as the documented fallback** when SSE is
  blocked.

### Internal fan-out

#### Option 2a: Redis Pub/Sub (Chosen)

- **Approach:** The writing node `PUBLISH`es `env:<id> changed vN`; all nodes hold a
  standing `SUBSCRIBE` and push to their own SSE streams.
- **Pros:** Decouples publisher from the number of nodes/streams; sub-ms in-memory
  fan-out; tiny messages; togglr already runs Redis (sessions/cache) so no new
  dependency; autoscale nodes freely.
- **Cons:** Fire-and-forget — a node briefly disconnected from Redis misses messages
  (healed by the version-check backstop); at-most-once delivery, not a durable log.

#### Option 2b: Postgres LISTEN/NOTIFY

- **Pros:** No extra infra beyond Postgres; transactional with the write.
- **Cons:** Ties fan-out to DB connections; NOTIFY payload limits; couples the hot
  broadcast path to the primary datastore. **Rejected because** Redis already exists and
  keeps broadcast load off Postgres.

#### Option 2c: A durable broker (Kafka/NATS)

- **Pros:** Durable, replayable, ordered.
- **Cons:** Heavy operational surface for a signal that Postgres already persists durably.
  **Rejected as** over-engineered — durability lives in Postgres; Redis only needs to
  deliver a "wake up" nudge.

## Decision

We will push ruleset-change signals to clients over **Server-Sent Events**, fan out
across API nodes with **Redis Pub/Sub**, and treat **polling as the fallback**.
Correctness does not depend on Pub/Sub delivery: every ruleset carries a **monotonic
per-environment version**, and on (re)connect the client sends its version and the node
replies with the current ruleset if stale. Redis provides *speed*; the version check
provides *correctness*.

To keep that backstop live even under a healthy-SSE/dead-subscription partition, each node
treats its Redis subscription as a **liveness dependency**: on losing the subscription it
closes its SSE streams so clients reconnect to a healthy node and version-check. SDKs also
run a **low-frequency version poll while SSE is connected** as belt-and-suspenders.

## Consequences

### Positive
- Minimal moving parts for a genuine real-time control plane; the browser dashboard
  validates the exact transport the SDK uses.
- Fan-out and durability are cleanly separated: Redis is best-effort speed, Postgres +
  version check is the source of truth.

### Negative
- SSE through hostile proxies needs heartbeats and a polling fallback path — two refresh
  code paths to maintain in the SDK.
- Pub/Sub's at-most-once delivery means the version-check reconciliation is mandatory, not
  optional.
- A single env change nudges every SDK on that env to conditional-GET at once (each receives
  a 200 with the new ruleset) — a fan-in spike. Bounded at ~1k connections and absorbed by
  the Phase-2 Redis ruleset cache (one cache read per node; ETag/304 for unchanged envs).

### Risks
- A node partitioned from Redis silently stops fanning out; mitigated by the
  subscription-liveness rule in the Decision (the node drops its SSE streams on subscription
  loss so clients reconnect to a healthy node and version-check) plus the SDK's low-frequency
  version poll. Reversible: the client contract (versioned ruleset + fetch endpoint) is
  transport-agnostic, so swapping SSE for WebSocket later would not change the SDK's
  freshness model.
