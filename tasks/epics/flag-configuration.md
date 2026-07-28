---
title: Flag Configuration
status: draft
owner: hapham
date: 2026-07-28
parent: docs/specs/togglr-platform.md
---

# Flag Configuration

## Business Value

The core product surface: a Flag Administrator defines flags and controls how they
resolve — a default value, ordered targeting rules (attribute matches), and percentage
rollouts — per environment, through both a REST management API and a web flag editor.
This is what customers actually *do* with togglr; the SDK and real-time epics exist to
deliver these configurations fast.

## Scope

### Included

- Flag CRUD: key, description, type (boolean in MVP; multivariate early Phase 2),
  per-environment default value, on/off state.
- Ordered targeting rules: attribute conditions → variation, evaluated top-to-bottom.
  MVP operators: `equals`, `not-equals`, `in`, `not-in`.
- Percentage rollouts with deterministic sticky bucketing; `bucketBy` selects the
  bucketing attribute (default = context `key`), and a context missing that key is
  excluded from the rollout (served the flag default/off).
- Management REST API for all of the above.
- Web flag editor UI (list, create, edit default/rules/rollout, toggle).
- Optimistic concurrency: mutations carry expected version → 409 on mismatch.
- The ruleset-fetch endpoint that returns an environment's full ruleset (consumed by
  the SDK epic).

### Excluded

- The evaluation engine and SDK runtime (Local-Evaluation SDK epic).
- Real-time push of changes (Real-Time Propagation epic) — MVP relies on SDK polling.
- Version history UI and rollback (Audit & Rollback epic), though mutations are audited
  from day one.
- Reusable named segments and expanded operator library (Audit & Rollback / later).
- Telemetry (Telemetry & Analytics epic).

## Dependencies

- **Auth & Sessions** + **Org Workspace & Isolation** — flags live under
  org/project/environment and are RLS-scoped; management actions require an
  authenticated, authorized session.

## Acceptance Criteria (Epic-Level)

- An admin can create, edit, toggle, and delete a boolean flag with a default and
  ordered rules through both API and web editor.
- A percentage rollout assigns users deterministically and stickily as the percentage
  increases (no flip-flopping).
- Concurrent edits are safe: a stale-version mutation is rejected with 409.
- The ruleset-fetch endpoint returns a correct, environment-scoped ruleset payload.
- Every mutation writes an audit record (consumed later by Audit & Rollback).

## Stories

To be broken down using the `write-story` skill.

## Open Questions

- [ ] Ruleset transport on fetch: full snapshot vs diff (spec lean: full snapshot).
- [ ] Flag-key immutability after creation and key naming constraints.
- [ ] Delete vs archive semantics for a flag still referenced by live SDKs (SDK falls
      back to caller `defaultValue`).
