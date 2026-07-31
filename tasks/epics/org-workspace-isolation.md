---
title: Org Workspace & Isolation
status: done
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

- [Create & manage organizations](../stories/org-create-manage-orgs.md) — M
- [PostgreSQL row-level security & per-request org context](../stories/org-rls-tenant-context.md) — L
- [Manage team members & roles](../stories/org-members-roles.md) — M
- [Invite teammates by email](../stories/org-invite-teammates.md) — L
- [Create & manage projects](../stories/org-projects.md) — M
- [Create & manage environments](../stories/org-environments.md) — M
- [Issue, rotate & revoke SDK keys](../stories/org-sdk-keys.md) — L
- [Rename projects & environments in the dashboard](../stories/org-rename-projects-environments-ui.md) — S
- [Gate member management controls by role in the dashboard](../stories/org-members-control-gating-ui.md) — S

## Resolved Decisions

All epic open questions were resolved against the approved
[Control Plane & Data Model](../../docs/design/control-plane-data-model.md) doc and the
accepted [RLS ADR](../../docs/design/adr-rls-tenant-isolation.md):

- [x] **RLS enforcement:** Postgres RLS keyed on a transaction-scoped `SET LOCAL
      app.current_org`, API as the non-privileged `togglr_app` role (no `BYPASSRLS`), via a
      per-request `TransactionRunner`. Unset context reads 0 rows (fail-closed); boot
      assertion refuses a privileged role. Foundation already stood up the role + policy
      pattern.
- [x] **SDK-key rotation:** grace window **24 h, configurable**; issuing a new key sets the
      old key's `expires_at = now() + grace`, both authenticate until it lapses. **No active
      rotation notification** for MVP — grace-window + UI-visible expiry only.
- [x] **Invites:** `pending`/`accepted`/`expired` states, hashed token, re-send regenerates
      the token. **Expiry: 7 days.**
- [x] **Environment model:** **user-defined** environments (not a fixed dev/staging/prod
      set), each with its own SDK-key namespace and monotonic `ruleset_version`.
