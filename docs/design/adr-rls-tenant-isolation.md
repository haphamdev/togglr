---
title: ADR — Tenant Isolation via Postgres RLS with Session-Variable Context
status: proposed
owner: hapham
date: 2026-07-28
parent: docs/design/architecture-overview.md
---

# ADR: Tenant Isolation via Postgres RLS with Session-Variable Context

## Status

Proposed

## Context

togglr is multi-tenant: every org's flags, projects, environments, keys, and audit
records must be invisible and immutable to every other org. The spec makes "0
cross-tenant reads/writes" a hard, tested goal and explicitly hands the *enforcement
mechanism* to this design (spec Open Question; Org Workspace epic Open Question).

Forces at play:

- The API runs as **N stateless nodes** behind a **connection pool**. A pooled
  connection is reused across requests for different orgs — any tenant context bound to
  a connection must not survive into the next request.
- A single forgotten `WHERE organization_id = …` in application code would leak data.
  We want the datastore to be the backstop, not developer discipline alone.
- The isolation must be provable by an automated test, including the
  pooled-connection-reuse case.

## Alternatives Considered

### Option 1: Postgres RLS + per-request `SET LOCAL` session variable (Chosen)

- **Approach:** Every tenant-scoped table has `organization_id` and an RLS policy
  `USING (organization_id = current_setting('app.current_org')::uuid)`. The API connects
  as a **non-privileged role that does not have `BYPASSRLS`**. Each request runs inside a
  transaction that first executes `SET LOCAL app.current_org = $orgId` (resolved from the
  authenticated session or SDK key). `SET LOCAL` is scoped to the current transaction, so
  the value is discarded at COMMIT/ROLLBACK and cannot bleed into the next borrower of a
  pooled connection.
- **Pros:** Database-enforced isolation independent of query correctness; safe under
  pooling because context is transaction-scoped; single policy pattern applied uniformly;
  directly testable (reuse a pooled connection across two orgs, assert zero rows);
  strongest defense-in-depth and the clearest interview story.
- **Cons:** Every tenant-scoped operation must run in a transaction with the `SET LOCAL`
  preamble — needs a disciplined data-access seam (a per-request transactional runner);
  the app DB role must never be a superuser/`BYPASSRLS` (RLS is silently skipped for
  those); a missing preamble fails closed (no rows) rather than leaking, which is the
  right failure direction but must be understood.

### Option 2: Application-level scoping only (`WHERE organization_id = ?`, no DB RLS)

- **Approach:** No database policies; every query manually filters by org.
- **Pros:** Simplest; ORM/query-builder agnostic; no transaction/role constraints.
- **Cons:** One missing clause = silent cross-tenant leak; isolation depends entirely on
  developer discipline and review; contradicts the spec's DB-enforced guarantee. **Rejected
  because** the headline isolation promise must not rest on remembering a `WHERE`.

### Option 3: Role or connection per tenant

- **Approach:** A distinct Postgres role/connection (or database/schema) per org; isolation
  via grants.
- **Pros:** Very strong physical isolation.
- **Cons:** Does not compose with a shared connection pool — connection/role explosion at
  many tenants; expensive context switching; heavy operational surface. **Rejected because**
  it defeats pooling and does not scale to many small tenants.

## Decision

We will enforce tenant isolation with **PostgreSQL row-level security keyed on a
transaction-scoped session variable (`SET LOCAL app.current_org`)**, with the API
connecting as a **non-privileged, non-`BYPASSRLS` role**. All tenant-scoped data access
goes through a **per-request transactional runner** that sets the org context before any
query. A dedicated integration test reuses a pooled connection across two orgs and
asserts zero cross-tenant rows.

Rationale: it is the only option that makes isolation a database invariant (not a coding
convention) while remaining compatible with a shared connection pool across stateless
nodes.

## Consequences

### Positive
- Cross-tenant access is structurally impossible for the app role, even with buggy
  queries; the guarantee is testable and enforced centrally.
- One uniform policy pattern; new tenant-scoped tables just add the column + policy.

### Negative
- Every tenant-scoped request pays for an explicit transaction + `SET LOCAL`; the
  data-access layer must funnel through the transactional runner (no ad-hoc pooled
  queries for tenant data).
- Operationally fragile in one specific way: if the app ever connects as a superuser or a
  `BYPASSRLS` role, RLS is silently bypassed. Guarded by config + a startup assertion.

### Risks
- A developer bypassing the transactional runner (raw pooled query) would run without org
  context and get zero rows — fails closed, but could look like a bug. Mitigate with a
  single sanctioned data-access seam and code-review checklist.
- Superuser/migration connections legitimately bypass RLS; migrations run as a separate
  privileged role, never the request-path role. Documented in the Control Plane doc.
