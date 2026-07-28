---
title: Org Workspace & Isolation
status: draft
owner: hapham
date: 2026-07-28
parent: docs/specs/togglr-platform.md
---

# Org Workspace & Isolation

## Business Value

The multi-tenant backbone: a signed-in user carves out an organization's workspace —
projects → environments — invites teammates with roles, and mints the per-environment
SDK keys machines use to reach togglr. Its headline promise is **tenant isolation**: one
org can never read or mutate another's data, enforced at the database layer via
PostgreSQL row-level security. Every flag, evaluation, and real-time feature is scoped by
what this epic establishes.

## Scope

### Included

- Org/project/environment hierarchy (CRUD).
- Coarse org roles: owner / admin / member, gating management actions.
- Team membership via **email-based invites**: send invite link → invitee accepts →
  joins the org with a role (account creation/linking handled by Auth & Sessions).
- Per-environment SDK secret keys: issue, list, revoke, and **rotate with a grace
  window** (old + new keys both valid for a configurable period for zero-downtime
  rotation); and **validate** inbound SDK-key authentication — the guard consumed by
  Ruleset Delivery, Real-Time, and Telemetry.
- PostgreSQL row-level security on every tenant-scoped table; per-request org context.
- Cross-tenant isolation integration tests (assert zero cross-tenant rows, including
  pooled-connection reuse across two orgs).

### Excluded

- Authentication and session management (Auth & Sessions epic).
- Flag definitions, rules, evaluation (Flag Authoring / Ruleset Delivery + SDK epics).
- Fine-grained/custom permissions and approval workflows (later phase).
- Billing / plans / quotas.

## Dependencies

- **Platform Foundation** — monorepo, shared-types, base API + web shell.
- **Auth & Sessions** — requires an authenticated user for all actions; the invite-accept
  flow relies on account creation/linking there.
- Infrastructure: PostgreSQL with RLS.

## Acceptance Criteria (Epic-Level)

- A user can create an org and its projects and environments.
- An owner/admin can invite a teammate by email; the invitee accepts and joins with an
  assigned role; roles gate management actions.
- Every tenant-scoped query is org-filtered by RLS; a deliberate cross-tenant access
  attempt returns nothing / is rejected, proven by tests that also reuse a pooled
  connection across orgs.
- SDK keys can be issued per environment, revoked, and rotated with a grace window
  during which both old and new keys authenticate; after the window the old key is denied.

## Stories

To be broken down using the `write-story` skill.

## Open Questions

- [ ] RLS enforcement mechanism (design-doc handoff): transaction-scoped context +
      dedicated non-privileged DB role, safe under connection pooling.
- [ ] SDK key rotation grace-window default duration and how consumers are notified.
- [ ] Invite expiry and re-send behavior; can invitees have a pending state before
      accepting?
- [ ] Environment model: fixed set (dev/staging/prod) or fully user-defined?
