---
title: Ruleset Delivery & Contract
status: draft
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
- **Flag Authoring** — provides the persisted flag/rule/rollout config this epic
  serializes and serves.
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

## Stories

- [Ruleset shape & version model (shared-types)](../stories/ruleset-shape-version-model.md) — M
- [Ruleset-fetch endpoint (SDK hot path)](../stories/ruleset-fetch-endpoint.md) — M
- [Cache-ready ruleset representation](../stories/ruleset-cache-ready-representation.md) — S

## Open Questions

- [ ] Ruleset transport on fetch: full snapshot vs diff (spec lean: full snapshot).
- [ ] Ruleset version type: integer counter vs monotonic timestamp/ULID.
- [ ] Payload versioning/compatibility strategy as the ruleset shape evolves (e.g. schema
      version field for forward-compat with older SDKs).
