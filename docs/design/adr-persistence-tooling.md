---
title: "ADR — Persistence Tooling: Kysely"
status: accepted
owner: hapham
date: 2026-07-28
parent: docs/design/architecture-overview.md
---

# ADR: Persistence Tooling — Kysely

## Status

Accepted

## Context

The API needs a way to talk to Postgres (queries + schema migrations). This choice is
coupled to [ADR: RLS tenant isolation](adr-rls-tenant-isolation.md), which requires:

- Running each tenant-scoped request in an **explicit transaction** with a `SET LOCAL
  app.current_org = …` preamble on that exact connection.
- Emitting **raw SQL** (`SET LOCAL`, and the RLS `CREATE POLICY` statements in
  migrations) with precise control over which connection runs what.
- Connecting as a **non-privileged role** on the request path and a separate privileged
  role for migrations.

Secondary forces: TypeScript-strict type safety end to end; a lightweight footprint that
keeps the eval/hot path and build simple; good-enough migration tooling for a solo
project.

## Alternatives Considered

### Option 1: Kysely (Chosen)

- **Approach:** A typed SQL query builder (not an ORM). You write SQL-shaped queries with
  full type inference; transactions and raw fragments are first-class; migrations via
  `kysely` migration files (or paired with `node-pg-migrate` for raw DDL like policies).
- **Pros:** Transparent control over transactions and the exact connection — the
  `SET LOCAL` preamble is trivial and unambiguous; raw SQL (RLS policies, `SET LOCAL`) is
  natural, not an escape hatch; strong types without decorators or a heavy runtime; small
  and fast; the generated SQL is obvious, which matters when reasoning about RLS.
- **Cons:** No entity/relations sugar — more explicit query code; migrations are less
  batteries-included than Prisma; smaller ecosystem.

### Option 2: Prisma

- **Approach:** Schema-first ORM with a generated client and first-class migrations.
- **Pros:** Best-in-class DX and migrations; very popular (resume signal); great typed
  client.
- **Cons:** `SET LOCAL` on a specific pooled connection requires the interactive-transaction
  + `$executeRaw` escape hatches; the client abstracts connection handling, which is
  exactly what the RLS approach needs precise control over; heavier runtime + engine.
  **Rejected because** it fights the RLS-per-transaction pattern instead of expressing it
  naturally.

### Option 3: Drizzle

- **Approach:** Typed SQL-first query builder with its own migration kit; similar
  philosophy to Kysely.
- **Pros:** Comparable low-level control and type safety; growing ecosystem; supports raw
  SQL and transactions cleanly.
- **Cons:** Migration story and API were evolving quickly; marginally more magic than
  Kysely for the same benefit. **Rejected because** for this project Kysely's thinner,
  more explicit model is the more conservative fit — a close call, not a strong dispreference.

### Option 4: TypeORM

- **Approach:** Decorator/entity ORM, classic in the NestJS ecosystem.
- **Pros:** Tight NestJS integration; familiar Active Record/Data Mapper patterns.
- **Cons:** Heavier; historically rough migration ergonomics; entity abstraction obscures
  the exact SQL/connection behavior RLS depends on. **Rejected because** it hides the
  connection control we specifically need.

## Decision

We will use **Kysely** for queries and transactions on the request path, connecting as a
non-privileged role, with a thin per-request transactional runner that issues the
`SET LOCAL app.current_org` preamble. Migrations (including RLS `CREATE POLICY` DDL) run
as a separate privileged role; if Kysely's migrator proves thin for raw DDL we pair it
with `node-pg-migrate` (settled in the Control Plane doc).

Rationale: the RLS decision needs transparent, per-connection transaction control and
natural raw SQL; Kysely provides exactly that with full type safety and minimal runtime,
where an ORM would require working against its abstractions.

## Consequences

### Positive
- The RLS `SET LOCAL` pattern is expressed directly and readably; generated SQL is
  predictable, aiding audits of tenant-scoping correctness.
- Lightweight, strict-typed, fast builds; no ORM runtime on the API.

### Negative
- More hand-written query code and no relation-loading sugar; slightly higher boilerplate
  than Prisma for CRUD-heavy modules.
- Migration tooling may need a companion library for raw DDL, adding one dependency.

### Risks
- Team familiarity/ecosystem is smaller than Prisma's; mitigated by Kysely's simplicity
  and SQL transparency. Reversible: the data-access seam is isolated behind repositories,
  so swapping the builder later touches one layer, not the whole API.
