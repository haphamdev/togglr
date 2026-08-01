---
title: Ruleset Delivery & Contract
status: approved
owner: hapham
date: 2026-07-28
parent: docs/specs/togglr-platform.md
---

# Ruleset Delivery & Contract

## Business Value

The contract that keeps the whole platform in lockstep and the endpoint that feeds every
consumer. It defines the **ruleset shape** (the serialized flags/rules/rollouts an SDK
evaluates), the **version model** every freshness and consistency guarantee depends on,
and the **ruleset-fetch endpoint** the SDK bootstraps from and refetches against. Getting
this contract right once means the SDK, real-time signals, telemetry, and audit all speak
the same language; getting it wrong forces re-cuts across every other epic.

## Scope

### Included

- **Ruleset shape** (in `packages/shared-types`): the canonical serialized representation
  of an environment's flags, rules, rollouts (and later segments) that `eval-core`
  consumes — identical for SDK and server-side preview.
- **Version model (two concepts):**
  - **Per-flag config version** — used by Flag Authoring for optimistic-concurrency 409s.
  - **Per-environment monotonic ruleset version** — bumped on any change in the
    environment; used by the SDK for freshness/version-check, by Real-Time as the signal
    payload, and stamped on telemetry events.
- **Ruleset-fetch endpoint**: returns an environment's full ruleset snapshot plus its
  current ruleset version; authenticated by the **SDK-key guard consumed from Org
  Workspace & Isolation**; env-scoped.
- A cache-ready ruleset representation (so Real-Time's Redis cache can front it later).
- **Payload schema version** (`schemaVersion`, starts at 1): a forward-compat field on the
  ruleset so the shape can evolve without breaking older SDKs (degrade-not-crash).

### Excluded

- Authoring/mutating flags and rules (Flag Authoring epic) — this epic serves what that
  one produces.
- The evaluation engine (shared `packages/eval-core`) — this epic defines the *shape*
  it consumes, not the algorithm.
- Real-time push and the Redis cache implementation (Real-Time Propagation epic) — this
  epic makes the representation cache-ready but doesn't build the cache.
- SDK-key issuance/rotation (Org Workspace & Isolation) — this epic only *consumes* the
  validation guard.

## Dependencies

- **Platform Foundation** — `packages/shared-types` and `eval-core` scaffolding.
- **Flag Authoring** — a *split* dependency, not a cycle: the **contract** (ruleset shape +
  version model) has no dependency on Flag Authoring and is a prerequisite *for* it; only the
  **serving endpoint** depends on Flag Authoring's persisted config. Ordering:
  contract → Flag Authoring → fetch endpoint.
- **Org Workspace & Isolation** — consumes its SDK-key validation guard to authenticate
  fetch requests; ruleset is environment-scoped and RLS-enforced.

## Acceptance Criteria (Epic-Level)

- The ruleset-fetch endpoint returns a correct, environment-scoped ruleset snapshot plus
  its current ruleset version, authenticated by a valid SDK key (invalid/revoked keys
  denied).
- The ruleset shape in `shared-types` is consumed unchanged by both the SDK and the
  server-side preview via `eval-core`.
- Any flag/rule/rollout change advances the per-environment ruleset version monotonically;
  the per-flag config version is independent and drives concurrency.
- The served representation is cache-friendly (stable, serializable) for later Redis
  fronting.
- Polling is a conditional GET: the endpoint returns `ETag: "<version>"`, answers a matching
  `If-None-Match` with `304` (empty body) and a stale one with `200` + the new ruleset — one
  endpoint serving both bootstrap and refresh.
- Under a datastore outage the endpoint fails closed with `503 DIZZY_OWL` (no Phase-1 cache),
  and the SDK falls back to its last-known ruleset.

## Stories

- [Ruleset shape & version model (shared-types)](../stories/ruleset-shape-version-model.md) — M
- [Ruleset-fetch endpoint (SDK hot path)](../stories/ruleset-fetch-endpoint.md) — M
- [Cache-ready ruleset representation](../stories/ruleset-cache-ready-representation.md) — S

## Resolved Decisions

Resolved against the approved [Ruleset & Evaluation Engine + SDK](../../docs/design/ruleset-evaluation-sdk.md)
design and the parent spec; the child stories carry the detailed ACs.

- [x] **Ruleset transport:** **full snapshot** on every fetch, never a diff.
      ([ruleset-evaluation-sdk.md:263]; spec `togglr-platform.md:161`)
- [x] **Ruleset version type:** a **monotonic integer** per-environment counter (not a
      timestamp/ULID). ([ruleset-evaluation-sdk.md:55,111]; `architecture-overview.md:120-134`)
- [x] **Payload compatibility:** a **`schemaVersion`** field (starts at 1) with
      **degrade-not-crash** semantics — an older SDK holds its last-known ruleset on an
      unparseable newer payload, or stays not-ready (`SDK_NOT_READY`) on first bootstrap.
      ([ruleset-evaluation-sdk.md:97-107])
