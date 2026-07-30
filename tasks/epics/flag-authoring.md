---
title: Flag Authoring
status: draft
owner: hapham
date: 2026-07-28
parent: docs/specs/togglr-platform.md
---

# Flag Authoring

## Business Value

The core product surface: a Flag Administrator defines flags and controls how they
resolve — a default value, ordered targeting rules (attribute matches), and percentage
rollouts — per environment, through a management REST API and a web flag editor, with a
built-in preview to test a flag against a sample context before saving. This is what
customers actually *do* with togglr; the ruleset those edits produce is delivered to
consumers by the Ruleset Delivery & Contract epic.

## Scope

### Included

- Flag CRUD: key, description, type (boolean in MVP; multivariate early Phase 2),
  per-environment default value, on/off state.
- Ordered targeting rules: attribute conditions → variation, evaluated top-to-bottom.
  MVP operators: `equals`, `not-equals`, `in`, `not-in`.
- Percentage rollouts with deterministic sticky bucketing; `bucketBy` selects the
  bucketing attribute (default = context `key`), and a context missing that key is
  excluded from the rollout (served the flag default/off).
- Management REST API (write side) for all of the above.
- Web flag editor UI (list, create, edit default/rules/rollout, toggle).
- **Server-side preview/debugger:** evaluate a draft flag against an admin-supplied
  sample context using the shared engine (`packages/eval-core`), so admins see the
  outcome before saving.
- Optimistic concurrency using the **per-flag config version**: mutations carry the
  expected version → 409 on mismatch.
- Writes an audit record on every mutation (surfaced later by Audit & Rollback) and
  bumps the environment ruleset version (owned by Ruleset Delivery & Contract) on change.

### Excluded

- The ruleset shape, version model, and ruleset-fetch endpoint (Ruleset Delivery &
  Contract epic).
- The evaluation engine itself (shared `packages/eval-core`; this epic consumes it for
  preview) and the SDK runtime (Local-Evaluation SDK epic).
- Real-time push of changes (Real-Time Propagation epic) — MVP relies on SDK polling.
- Version history UI and rollback (Audit & Rollback epic), though mutations are audited
  from day one.
- Reusable named segments and expanded operator library (Segments & Advanced Targeting).
- Telemetry (Telemetry & Analytics epic).

## Dependencies

- **Platform Foundation** — monorepo, shared-types, base API + web shell, `eval-core`.
- **Auth & Sessions** + **Org Workspace & Isolation** — flags live under
  org/project/environment and are RLS-scoped; management actions require an
  authenticated, authorized session.
- **Ruleset Delivery & Contract** — defines the ruleset shape and version model that
  authored config must conform to.

## Acceptance Criteria (Epic-Level)

- An admin can create, edit, toggle, and delete a boolean flag with a default and
  ordered rules through both API and web editor.
- A percentage rollout assigns users deterministically and stickily as the percentage
  increases (no flip-flopping).
- The preview evaluates a draft flag against a sample context and matches what the SDK
  would return (same `eval-core`).
- Concurrent edits are safe: a stale per-flag-version mutation is rejected with 409.
- Every mutation writes an audit record and advances the environment ruleset version.

## Stories

- [eval-core evaluation engine (shared)](../stories/flag-eval-core-engine.md) — L
- [Create & manage flags](../stories/flag-crud.md) — M
- [Edit per-environment flag config (toggle, default, rules, rollout)](../stories/flag-config-edit.md) — L
- [Server-side flag preview / debugger](../stories/flag-preview.md) — M
- [Web flag editor UI](../stories/flag-editor-ui.md) — L

## Open Questions

- [ ] Flag-key immutability after creation and key naming constraints.
- [ ] Delete vs archive semantics for a flag still referenced by live SDKs (SDK falls
      back to caller `defaultValue`).
- [ ] Preview context input: manual entry only, or replay of a recent real context?
