---
title: togglr — Low-Latency Multi-Tenant Feature Flag Platform
status: draft
owner: hapham
date: 2026-07-27
parent:
---

# togglr — Low-Latency Multi-Tenant Feature Flag Platform

## Problem Statement

Shipping software safely means decoupling **deploy** from **release**. Teams want to
merge code continuously but expose it gradually — to internal users first, then a
percentage of customers, then everyone — and to kill a bad change **instantly**
without a redeploy or rollback of the binary. Feature flags are the standard
mechanism, but building a good flag system in-house is hard:

- **Latency:** naive implementations call a flag service on every check, adding
  network round-trips (10–50ms+) to hot code paths. At scale this is unacceptable.
- **Staleness:** polling-based updates mean a killed flag can take seconds to
  minutes to actually stop serving — during an incident that is the difference
  between a blip and an outage.
- **Isolation:** a shared flag service for multiple teams/customers must guarantee
  one tenant can never read or mutate another's configuration.
- **Auditability:** flag changes are production changes. Without version history and
  fast rollback, "who turned this on and how do I undo it?" becomes a fire drill.

togglr solves these as a hosted, multi-tenant platform: organizations sign up,
model their projects and environments, define targeting rules, and toggle flags in
real time — while consumer applications embed a lightweight SDK that evaluates flags
**locally in sub-5ms** and receives updates **the moment** they happen.

> **Note on evidence:** this is a portfolio/side project. The problem is real and
> well-established across the industry (LaunchDarkly, Unleash, Flagsmith, Split all
> exist to solve it), but there is no internal user-complaint or support-ticket
> corpus behind this spec. The goal is to demonstrate product thinking and
> engineering depth on a genuinely hard distributed-systems problem, not to serve a
> paying customer today.

## Target Users

togglr serves **software teams**, mediated by two primary personas (plus an operator):

1. **Flag Administrator** (engineer, EM, or product manager)
   — signs up an organization, invites teammates, creates projects/environments,
   defines flags and targeting rules, and performs kills/rollbacks. Works through the
   togglr **web app + API**. Cares about: safety, clarity of "what is on for whom
   right now," and speed of change.

2. **Consumer Application** (the customer's running service)
   — integrates the togglr **SDK** to evaluate flags. Cares about: negligible latency,
   resilience when togglr is unreachable, and correctness (never serving a stale
   value after a change has been made).

Secondary persona: **Platform Operator** (me) — needs the system to be observable,
tenant-isolated by construction, and horizontally scalable.

### How they work today (without togglr)

- Hardcoded booleans / config files requiring a redeploy to change.
- Environment variables toggled by ops, with no targeting and no audit.
- A homegrown DB table read per request (slow, no real-time, no rollback).

## Goals & Success Metrics

| Goal                                     | Metric                                                         | Target                                                                          |
| ---------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Fast evaluation on the consumer hot path | p99 in-process `evaluate()` latency in the SDK                 | < 5 ms (target sub-millisecond for cached rulesets)                             |
| Real-time invalidation                   | Time from admin toggle → SDK serves new value (same region)    | < 1 s p95 (Phase 2; Phase 1 uses polling with a looser bound)                    |
| Tenant isolation                         | Cross-tenant data reads/writes possible via the API            | 0 (enforced by Postgres RLS; proven by tests)                                   |
| Consumer resilience                      | SDK behavior when togglr API is unreachable                    | Serves last-known ruleset; no exceptions thrown to host app                     |
| Throughput                               | Flag evaluations served without extra API calls                | Unbounded (evaluation is local; API load scales with SDK count, not eval count) |
| Telemetry non-intrusiveness              | Added latency on host app from telemetry emission              | ~0 (async, batched, fire-and-forget)                                            |
| Auditability                             | Config changes with a recorded actor + before/after + rollback | 100% of mutations                                                               |

Because this is a portfolio project, "success" also includes: a clean, documented
architecture; a load test demonstrating the latency/throughput claims; and a
readable codebase that stands up in a technical interview.

## Non-Goals / Out of Scope

- **Client-side / browser / mobile SDKs.** v1 is a **server-side TypeScript SDK
  only**. Browser SDKs require a different security model (no secret keys, client-side
  eval, exposure of ruleset) and are deferred. _Why: keeps the ruleset in a trusted
  server process, which is what makes local evaluation safe._
  _(This non-goal excludes SDKs **embedded in a customer's** browser/mobile app._
  _togglr's own admin web app — a first-party React SPA — is in scope; see the_
  _"Web application" section below.)_
- **Non-TypeScript SDKs** (Go, Python, Java, etc.). Deferred; the streaming protocol
  will be documented so they _could_ be added.
- **Experimentation / A-B statistical analysis** (significance testing, metric lift).
  togglr records evaluation telemetry but does not compute experiment results in v1.
- **Approval workflows / change requests / RBAC beyond basic org roles.** v1 has
  simple roles (owner/admin/member); granular permissions and multi-step approvals
  are later.
- **Self-hosted / on-prem distribution.** togglr is a hosted SaaS; a self-host
  packaging is out of scope.
- **Billing / payments.** Sign-up and org management exist; monetization does not.
- **Multi-region active-active replication.** Single-region deployment for v1;
  the architecture should not preclude it later.
- **Server-side rendering / Next.js for the admin web app.** The dashboard is a
  login-gated internal tool with no SEO need; it ships as a **React SPA** against the
  NestJS API. NestJS stays the single backend — no second server runtime, no
  server-actions/BFF layer.

## Proposed Solution

### Domain model

```
Organization (tenant boundary)
  └── Project            e.g. "checkout-service"
        └── Environment  e.g. "production", "staging", "development"
              └── Flag   e.g. "new-checkout-ui"
                    ├── default value (on/off, or a variant)
                    ├── targeting rules (ordered)
                    └── variations (for multivariate flags)
```

- **Organization** is the tenant boundary. Every row in the system is scoped to an
  org and access is enforced by **PostgreSQL row-level security**.
- **Project** groups flags for one application/service.
- **Environment** is an isolated set of flag states within a project. A flag can be
  **on in staging, off in production**. Each environment issues **SDK keys**
  (a server-side secret key) that the SDK uses to fetch/stream _that_ environment's
  ruleset.
- **Flag** has a default value and an **ordered list of targeting rules**; the first
  matching rule wins, else the default applies.

### Rule evaluation engine

A flag evaluation takes a **flag key** + an **evaluation context** (the user/entity:
a `key`, plus arbitrary attributes like `country`, `plan`, `email`, `beta: true`) and
returns a value. Rules are evaluated **in order**; the first match wins:

- **Attribute conditions** — `country in [US, CA]`, `plan == "enterprise"`,
  `email endsWith "@acme.com"`, numeric/string/semver comparisons, set membership.
- **Percentage rollouts** — deterministic bucketing: hash(`flag key` + context `key`)
  → a stable bucket 0–99, so the same user always lands the same way and a "20%
  rollout" is consistent and sticky as it grows to 30%, 40%, ….
- **Segments (later phase)** — named, reusable groups of conditions referenced by
  multiple flags.

Evaluation is a **pure function** over `(ruleset, context)` with **no I/O**, which is
what makes sub-5ms trivially achievable and makes the engine unit-testable in
isolation. The identical engine runs both in the SDK (primary path) and server-side
(for the web app preview / debugger).

**Evaluation contract (SDK):** `evaluate(flagKey, context, defaultValue)` — the caller
always supplies a `defaultValue`. The call **never throws into the host application**;
it returns `defaultValue` for any of: unknown flag key, SDK not yet finished
bootstrapping its ruleset, or a context missing the required `key`. This is what makes
the resilience guarantee (see Goals) hold at the API level. A typed convenience layer
(`evaluateBool` / `evaluateString` / `evaluateJson` with type-checked defaults) is a
later refinement.

### Evaluation architecture (local evaluation, "Model B")

The SDK does **not** ask the API for a value per check. On startup it authenticates
with its environment SDK key, **downloads the full ruleset** for that environment,
caches it in memory, and evaluates flags **in-process**. It keeps the cache fresh via
a live connection. This means:

- Evaluation is a local function call → sub-5ms, no per-check network I/O.
- API load scales with the **number of connected SDKs**, not with the number of
  evaluations (which may be millions/sec).
- The host app keeps working during network blips — it serves the last-known ruleset.

### Real-time invalidation (SSE + Redis Pub/Sub)

When an admin changes a flag, the change must reach every connected SDK fast:

1. The API node handling the request **persists** the change to Postgres (source of
   truth) **and writes an audit record**.
2. It **publishes** a small "environment X changed (version N)" message to a **Redis
   Pub/Sub** channel.
3. **All** API nodes subscribe to those channels; Redis fans the message out to every
   node instantly.
4. Each node pushes an update over its open **Server-Sent Events** streams to the SDKs
   it holds. The SDK refreshes its in-memory ruleset (fetching the new ruleset or
   applying a diff).

Redis Pub/Sub is an **internal, togglr-owned** component (same trust zone as the
database); customers never touch it. It exists solely to fan changes across
horizontally-scaled API nodes, since any given SDK's SSE stream is pinned to one node
while the admin's write may land on another.

**Correctness backstop:** every ruleset carries a monotonic **version**. Pub/Sub
messages are ephemeral (fire-and-forget), so on (re)connect the SDK sends its current
version and the node replies with the latest ruleset if it is stale. Redis provides
_speed_; the version check provides _correctness_. **Polling** (periodic version
check) is the documented fallback when SSE is blocked by an intermediary.

```
Admin toggle → API node A → Postgres (write + audit)
                          → Redis PUBLISH env:acme:prod v42
Redis → (all nodes A,B,C) → SSE push → SDKs refresh in-memory ruleset → local re-eval
```

### Tenant isolation (row-level security)

Every tenant-scoped table carries an `organization_id`. **PostgreSQL RLS policies**
restrict every row to the current org, and the API sets the org context per request
(e.g. `SET app.current_org = …` within the request's transaction) after
authentication. Application code therefore **cannot** accidentally leak across tenants
even if a query forgets a `WHERE organization_id = …` clause — the database enforces
it. This is defense-in-depth over application-level scoping, and is proven by
integration tests that attempt cross-tenant access and assert zero rows.

### SDK & telemetry analytics

The SDK collects **evaluation telemetry** — flag hits per variation, evaluation
latency, and errors — and ships them **asynchronously**: buffered in memory, batched,
and flushed on an interval / size threshold via fire-and-forget HTTP, off the host
app's hot path. togglr aggregates these into per-flag dashboards (evaluation counts,
variation distribution, error rate, "is this flag still being evaluated / safe to
remove?"). Telemetry never blocks or throws into the host application.

### Audit trail & rollback

Every configuration mutation (flag created/updated/toggled, rule changed, environment
change) writes an **immutable audit record**: actor, timestamp, target, and a
before/after snapshot. The admin can view a flag's **version history** and perform a
**one-click rollback** to any prior version, which is itself recorded as a new change
(and propagates in real time like any other change). This makes "undo the bad toggle"
a single, safe, audited action.

**Concurrent edits** use **optimistic concurrency**: every mutation carries the
**expected current version**; if it no longer matches (another admin or a rollback
changed the config first), the API rejects with a **409 Conflict** and the client
re-fetches and retries. This keeps the version/audit chain linear and prevents silent
clobbering during live multi-admin editing.

### Web application (admin dashboard)

The web app is how **Flag Administrators** operate togglr. It is a **React
single-page application** (Vite + React Router, TanStack Query for server-state,
Tailwind CSS + shadcn/ui for the interface) served as static assets and talking to
the NestJS API over HTTPS. There is **no SSR and no second backend**: NestJS owns all
domain logic; the SPA is a pure client. This keeps togglr's architecture a single API
consumed by two clients — the browser dashboard and the server-side SDK.

Core screens (Phase 1): sign-up / login, org + team management, project and
environment management, SDK-key management, and the flag list + flag editor (default
value, ordered rules, percentage rollout). Later phases add telemetry dashboards and
audit history / rollback.

**Dogfooding real-time:** once SSE lands (Phase 2), the dashboard subscribes to the
same stream the SDKs use, so a flag toggled by one teammate updates every other
teammate's open dashboard live — validating the real-time transport against a browser
client.

### Authentication & authorization

Two clients, two mechanisms matched to their threat models:

- **Browser → API:** **httpOnly, Secure session cookies** backed by **server-side
  sessions in Redis**, with `SameSite` + CSRF-token protection on mutations. The
  session token is never exposed to JavaScript (immune to XSS token theft), and
  server-side sessions give **instant revocation** (kill one session, or all of a
  user's sessions, on demand) — which ties into the audit/security story.
- **SDK → API:** **per-environment secret keys**, each scoped to exactly one
  environment's ruleset; rotatable and revocable.

**Authorization** in v1 is coarse org roles (owner / admin / member); finer-grained
permissions and approval workflows are a later phase (see Non-Goals). Every request is
org-scoped and enforced by Postgres RLS regardless of role.

### Delivery phasing

**Phase 1 — MVP (core platform):**

- Org sign-up, projects, environments, SDK keys, basic org roles.
- Flag CRUD (boolean + multivariate), ordered targeting rules, percentage rollouts.
- REST API for management + ruleset fetch.
- Server-side TypeScript SDK with **local evaluation** and **polling** refresh.
- Postgres with **row-level security** tenant isolation.
- Web app (React SPA): sign-up/login (session-cookie auth), org/project/environment
  management, SDK-key management, and the flag editor (default, rules, rollout).

**Phase 2 — Real-time:**

- SSE streaming endpoint + Redis Pub/Sub fan-out + version/reconnect logic.
- SDK switches primary refresh to streaming; polling becomes fallback.
- Redis-backed high-throughput ruleset cache in front of Postgres.
- Admin web app subscribes to the SSE stream — flag changes appear live in the
  dashboard (dogfoods the real-time transport against a browser client).

**Phase 3 — Telemetry & analytics:**

- Async batched telemetry ingestion + aggregation + per-flag dashboards.

**Phase 4 — Audit & rollback:**

- Full version history UI + one-click rollback.
- Reusable segments; expanded targeting operators.

### Key User Flows

1. **Onboard & configure (Flag Administrator)**
   Sign up → create org → create project "checkout" → create environments
   (dev/staging/prod) → copy the prod SDK key → create flag `new-checkout-ui` →
   add rule "`plan == enterprise` → on", default off → save. Change is persisted +
   audited.

2. **Integrate & evaluate (Consumer Application)**
   `const togglr = new Togglr({ sdkKey })` → SDK fetches+caches the prod ruleset →
   host code calls `togglr.evaluate("new-checkout-ui", { key: userId, plan }, false)` →
   returns locally in sub-5ms → SDK asynchronously reports the evaluation as
   telemetry.

3. **Gradual rollout (Flag Administrator)**
   Edit `new-checkout-ui` → add "percentage rollout 10%" → save → within ~1s all
   connected SDKs serve the new ruleset; ~10% of users (deterministically) get the
   new UI. Bump to 25%, 50%, 100% over time; buckets are sticky.

4. **Incident kill + rollback**
   New UI is breaking checkout → admin flips flag off (or clicks rollback to the
   prior version) → propagates in <1s → error rate drops. Action recorded in audit
   history.

5. **SDK during an outage**
   togglr API becomes unreachable → SDK keeps evaluating against its last-known
   in-memory ruleset, retries the stream/poll with backoff, and resumes live updates
   on reconnect (version check heals any missed change). Host app never errors from
   togglr being down.

6. **Live collaboration (two Flag Administrators)**
   Admin A has the flag list open; Admin B toggles a flag → the change propagates via
   SSE and A's dashboard reflects the new state within ~1s, no manual refresh.

## Dependencies & Risks

| Dependency / Risk                 | Impact                                                      | Mitigation                                                                                                                                       |
| --------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| PostgreSQL RLS correctness        | A policy gap = cross-tenant leak (worst-case failure)       | RLS on every tenant table; per-request org context in a transaction; integration tests that assert zero cross-tenant rows; code review checklist |
| Redis availability                | Real-time fan-out stops                                     | Postgres remains source of truth; SDKs fall back to polling + version check; degraded, not broken                                                |
| SSE through customer proxies/LBs  | Some networks buffer/kill long-lived streams                | Polling fallback; heartbeats/keep-alive; documented network requirements                                                                         |
| Ruleset in customer memory        | Sensitive rules exposed in the host process                 | Server-side SDK + secret keys only (browser SDK explicitly out of scope); scope keys to one environment                                          |
| Sub-5ms claim under load          | Headline metric may not hold if unproven                    | Pure, I/O-free engine; benchmark + load test as an acceptance gate for Phase 1                                                                   |
| Deterministic bucketing stability | Users flip variation as rollout % changes → broken UX/trust | Hash(flagKey+contextKey) with a stable algorithm; unit tests asserting stickiness across % increases                                             |
| Telemetry volume                  | High-throughput ingestion could overwhelm storage           | Async batching client-side; aggregate on ingest; sampling/retention limits                                                                       |
| Scope (solo, side project)        | Full vision is large; risk of never shipping                | Strict phasing; Phase 1 MVP is independently demoable and interview-ready                                                                        |
| Web app session/credential theft  | A stolen admin session can toggle prod flags across the org | httpOnly + Secure + SameSite cookies (no token in JS storage); CSRF tokens; Redis-backed sessions with instant revocation; idle timeout          |
| SSE to the browser dashboard      | Long-lived stream dropped by proxies                        | Auto-reconnect + version check (same backstop as the SDK); refetch-on-focus via TanStack Query                                                   |

## Open Questions

- [ ] **Multivariate flags in MVP or Phase 2?** Boolean-only is simpler for Phase 1;
      multivariate (string/JSON variations) is more impressive but adds targeting/telemetry
      complexity. Current lean: boolean in MVP, multivariate early Phase 2.
- [ ] **Ruleset transport on update — full snapshot vs diff?** Full snapshot is simpler
      and fine at small ruleset sizes; diffs scale better. Lean: full snapshot in Phase 2,
      revisit if payloads grow.
- [ ] **How is the evaluation context supplied for the web app "preview/debugger"?**
      Manual attribute entry, or replay of recent real contexts from telemetry?
- [ ] **Telemetry retention & aggregation granularity** (per-minute? per-hour?) and
      storage choice (Postgres rollups vs a time-series store) — deferred to Phase 3.
- [ ] **Target scale for the load test** that validates the <5ms / <1s claims — what
      numbers do we commit to demonstrating (e.g. N SDKs, M evals/sec)?
- [ ] **RLS enforcement mechanism (design-doc handoff)** — the technical design must
      specify a tenant-context approach that is safe under connection pooling
      (transaction-scoped context, dedicated non-privileged DB role) plus a test that
      reuses a pooled connection across two orgs. Kept out of this product spec on purpose.
- [ ] **Percentage-rollout bucketing** — support a `bucketBy` attribute (default =
      context `key`) so cohorts can flip together (e.g. by org)? And what is the behavior
      when the context has no `key` (anonymous)?
- [ ] **Multivariate rollout distribution** — weighted variation splits (not a single
      on/off bucket) once multivariate lands; resolve alongside the multivariate-phase
      question above.
- [ ] **SDK key rotation semantics** — grace window (old + new valid) vs instant
      invalidation that drops live streams?
- [ ] **Flag lifecycle** — archival/deletion, and confirmation that a live SDK returns
      the caller's `defaultValue` for a deleted flag key still referenced in host code.
- [ ] **Telemetry event shape** — pin the per-evaluation event fields now (flagKey,
      variation, timestamp, latency bucket) so Phase 1 SDKs emit forward-compatible data.
