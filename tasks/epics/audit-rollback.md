---
title: Audit & Rollback
status: draft
owner: hapham
date: 2026-07-28
parent: docs/specs/togglr-platform.md
---

# Audit & Rollback

## Business Value

Safety and accountability for configuration changes: a complete, tamper-evident history
of who changed what and when, and the ability to **undo a bad change in one click** by
restoring a prior version. During an incident this is the fastest path back to a known-
good state; day-to-day it's the audit trail that makes multi-admin editing trustworthy.

## Scope

### Included

- Immutable version history for every config mutation (flag, rule, rollout, environment
  settings), capturing actor, timestamp, before/after.
- Audit history UI: browse and inspect changes per flag/environment.
- **Whole-flag snapshot restore:** each flag mutation snapshots the flag's full config;
  one-click rollback restores a prior snapshot. The restore is itself recorded as a new
  audited change and respects optimistic-concurrency rules.

### Excluded

- The mutation/audit-write plumbing itself (Flag Authoring writes audit records from
  day one; this epic adds history UI + rollback on top).
- Reusable segments and expanded targeting operators (Segments & Advanced Targeting epic).
- Per-field/per-rule granular restore (whole-flag snapshot only).
- Approval workflows / change review gates (later phase, per Non-Goals).
- Cross-environment promotion of changes.

## Dependencies

- **Platform Foundation** — monorepo, shared infra.
- **Flag Authoring** — provides the versioned mutations and audit records this epic
  surfaces and reverts; reuses the optimistic-concurrency mechanism.
- **Auth & Sessions** + **Org Workspace & Isolation** — history and rollback are
  RLS-scoped and role-gated.
- **Real-Time Propagation** *(soft)* — once it lands, a rollback propagates live like any
  other change; not a hard dependency (in Phase 1 a rollback propagates via the existing
  polling refresh).

## Acceptance Criteria (Epic-Level)

- Every mutation appears in history with actor, timestamp, and before/after detail.
- An admin can roll back a flag to a prior version in one click; the restore is itself
  audited and propagates like a normal change.
- A rollback that races a concurrent edit is handled by optimistic concurrency (409 +
  refetch), never silently clobbering.

## Stories

To be broken down using the `write-story` skill.

## Open Questions

- [ ] History retention (unbounded vs capped/archived).
- [ ] Does history capture non-flag config (environment settings, key rotations) in v1,
      or flags only?
- [ ] Diff rendering in the history UI (field-level highlight of what changed).
