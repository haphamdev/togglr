---
title: "togglr — Glossary"
status: draft
owner: hapham
date: 2026-07-29
parent: docs/specs/togglr-platform.md
---

# togglr — Glossary

A single reference for the domain terms and abbreviations used across togglr's product
spec, design docs, ADRs, and API contract — and the vocabulary that appears in the code
(`shared-types`, `eval-core`, the SDK, the NestJS API). Definitions are written in
togglr's own terms; each entry links to the most authoritative source. Stack/tooling
proper nouns (NestJS, React, Kysely, Redis, Postgres, Vite, Biome, pnpm, Mailhog) and
generic web acronyms (API, CRUD, UUID, TTL, CI, PR, HTTP status codes) are intentionally
out of scope. Terms are alphabetical within each group.

## Product & Flag Concepts

- **bucketBy** — the context attribute chosen for percentage bucketing (default `key`). If the chosen attribute is absent from the context, the context is excluded from the rollout and served the flag default, with reason `MISSING_KEY`. Setting it to e.g. `orgId` makes a whole org flip together. _See:_ [Ruleset & Evaluation + SDK](design/ruleset-evaluation-sdk.md).
- **Bucketing / bucket** — a deterministic float in `[0, 100)` derived from the first 8 hex chars of `sha256(`​`${flagKey}:${bucketByValue}`​`)` divided by `0x100000000` and scaled by 100. A rollout applies when `bucket < percentage`. Pure hash, no seed or clock, so it is stable across the SDK and the API. _See:_ [Ruleset & Evaluation + SDK](design/ruleset-evaluation-sdk.md).
- **Caller default value (`defaultValue`)** — the value the host passes to `evaluate()`. It is returned **only** for non-resolvable cases: `SDK_NOT_READY`, `FLAG_NOT_FOUND`, `MISSING_KEY`, and `TYPE_MISMATCH`. It is distinct from the flag's configured default variation. _See:_ [Ruleset & Evaluation + SDK](design/ruleset-evaluation-sdk.md).
- **Condition** — one clause of a rule: an `attribute`, an `operator`, and `values`. A rule's conditions are AND-ed. A condition whose attribute is absent from the context is **false for every operator**, positive and negative alike (e.g. `country not-in [US]` does not fire when `country` is absent). _See:_ [Ruleset & Evaluation + SDK](design/ruleset-evaluation-sdk.md).
- **Default variation** — the flag's **configured** value. It is served when the flag is enabled and no rule matches (reason `DEFAULT`) and when the flag is off (`enabled=false`, reason `FLAG_OFF`). It is distinct from the caller default value. _See:_ [Ruleset & Evaluation + SDK](design/ruleset-evaluation-sdk.md).
- **enabled / master switch** — the per-environment boolean on a flag config. When `false`, evaluation skips all rules and serves the configured default variation (reason `FLAG_OFF`) — **not** the caller default value. _See:_ [Ruleset & Evaluation + SDK](design/ruleset-evaluation-sdk.md).
- **`evaluate()` contract** — the pure engine call `evaluate(ruleset, flagKey, context, defaultValue)`. It never throws into the host and returns the caller default for every non-resolvable case. The SDK and the API preview both call it. _See:_ [Ruleset & Evaluation + SDK](design/ruleset-evaluation-sdk.md).
- **Evaluation context (`EvaluationContext`)** — the per-call attributes the engine matches rules against: an optional `key` (the default bucketing identifier) plus arbitrary string/number/boolean attributes. _See:_ [Ruleset & Evaluation + SDK](design/ruleset-evaluation-sdk.md).
- **Evaluation result (`EvaluationResult`)** — the `{ value, reason }` object returned by `evaluate()`, where `value` is the resolved variation and `reason` explains how it was reached. _See:_ [Ruleset & Evaluation + SDK](design/ruleset-evaluation-sdk.md).
- **Feature flag (flag)** — a named toggle a consumer app reads to gate or vary behavior. It has a type, a per-environment config, a default variation, and an ordered list of targeting rules; the first matching rule wins, else the default applies. _See:_ [Platform Spec](specs/togglr-platform.md).
- **Flag key** — the flag's immutable identifier, pattern `^[a-z0-9-]+$`, unique per project; it cannot change after creation. _See:_ [Control Plane & Data Model](design/control-plane-data-model.md).
- **Kill switch / killing a flag** — setting `enabled=false` to instantly stop serving a bad change without a redeploy or binary rollback. _See:_ [Platform Spec](specs/togglr-platform.md).
- **Multivariate** — flags with more than on/off (string/JSON variations). Deferred past the MVP; the ruleset shape reserves for it via union types so it lands without a breaking change. _See:_ [Ruleset & Evaluation + SDK](design/ruleset-evaluation-sdk.md).
- **Operator** — the comparison in a condition. MVP set: `equals`, `not-equals`, `in`, `not-in`. _See:_ [Ruleset & Evaluation + SDK](design/ruleset-evaluation-sdk.md).
- **Preview (server-side preview / debugger)** — a read-only API endpoint that runs the same `eval-core` engine over a draft or saved config plus an admin-supplied context, returning the exact result the SDK would compute (parity). _See:_ [Control Plane & Data Model](design/control-plane-data-model.md).
- **Reason** — the enum on an evaluation result explaining how the value was reached: `RULE_MATCH` (a rule's conditions matched → its variation); `ROLLOUT` (a rollout rule applied, `bucket < percentage`); `DEFAULT` (no rule matched → default variation); `FLAG_OFF` (`enabled=false` → default variation); `FLAG_NOT_FOUND` (unknown or archived flag key → caller default); `SDK_NOT_READY` (ruleset not yet bootstrapped → caller default); `MISSING_KEY` (a rollout was skipped because its `bucketBy` attribute was absent and nothing else matched → flag default); `TYPE_MISMATCH` (the typed convenience layer, e.g. `evaluateBool`, got a non-boolean variation → caller default; dormant in the boolean-only MVP). _See:_ [Ruleset & Evaluation + SDK](design/ruleset-evaluation-sdk.md).
- **Rollout (percentage rollout)** — a rule result that serves a variation to a deterministic percentage of contexts via bucketing (`bucket < percentage`). _See:_ [Ruleset & Evaluation + SDK](design/ruleset-evaluation-sdk.md).
- **Rule** — an ordered entry of AND-ed conditions leading to a result (a variation or a rollout). First match wins; a rule with empty conditions always matches. _See:_ [Ruleset & Evaluation + SDK](design/ruleset-evaluation-sdk.md).
- **Segment** — a reusable, named set of targeting conditions (Phase 4) that rules can reference. The ruleset carries segment definitions so `eval-core` resolves them locally without an extra fetch. _See:_ [Platform Spec](specs/togglr-platform.md).
- **Sticky / stickiness (monotonic bucketing)** — the property that the rollout percentage is **not** part of the bucketing hash, so raising a rollout only *adds* buckets; a context in at X% stays in at any higher percentage (no flip-flopping). _See:_ [Ruleset & Evaluation + SDK](design/ruleset-evaluation-sdk.md).
- **Targeting** — directing a particular variation to a subset of contexts through ordered rules and rollouts. _See:_ [Platform Spec](specs/togglr-platform.md).
- **Variation** — the value a flag resolves to. Boolean in the MVP (`Variation = boolean`), typed as a union so string/JSON variations can be admitted later. _See:_ [Ruleset & Evaluation + SDK](design/ruleset-evaluation-sdk.md).

## Organizations, Tenancy & Access

- **Environment** — an isolated set of flag states within a project (e.g. dev/staging/prod; user-defined, not a fixed set). Each environment has its own SDK keys and its own monotonic ruleset version. _See:_ [Platform Spec](specs/togglr-platform.md).
- **Grace window / key rotation** — issuing a replacement SDK key keeps the old key valid until `now() + grace` (default 24 h, configurable), so both authenticate during the window for zero-downtime rotation; after it, the old key is denied. _See:_ [Control Plane & Data Model](design/control-plane-data-model.md).
- **Invite** — an email invitation to join an org at a given role. The token is stored hashed; states are pending / accepted / expired, and re-sending regenerates the token. _See:_ [Control Plane & Data Model](design/control-plane-data-model.md).
- **Membership / role** — a user's link to an org carrying a role. Role capabilities: `member` = read + preview; `admin` = author flags, manage environments/keys, manage invites; `owner` = manage org + members. Ordering `owner > admin > member`, enforced by `RolesGuard` in addition to RLS. _See:_ [Control Plane & Data Model](design/control-plane-data-model.md).
- **Organization (org)** — the tenant boundary and the top of the hierarchy (org → project → environment → flag), identified by an immutable slug. One org equals one tenant. _See:_ [Control Plane & Data Model](design/control-plane-data-model.md).
- **Project** — a grouping of flags under an org; immutable key, unique per org. Flag definitions live at project scope. _See:_ [Control Plane & Data Model](design/control-plane-data-model.md).
- **SDK key** — a per-environment secret (`tgl_<envPrefix>_<random>`) the SDK uses to fetch that environment's ruleset. Shown once; stored as a prefix plus a SHA-256 hash; rotatable and revocable. _See:_ [Control Plane & Data Model](design/control-plane-data-model.md).
- **Tenant / multi-tenant** — an isolated customer data space. togglr runs many tenants on shared infrastructure, with one org mapping to exactly one tenant. _See:_ [Platform Spec](specs/togglr-platform.md).
- **Tenant isolation** — the guarantee that one org can never read or mutate another org's data, enforced in the database by row-level security plus role/membership checks. _See:_ [ADR: RLS Tenant Isolation](design/adr-rls-tenant-isolation.md).

## Versioning & Consistency

- **Conditional GET** — the ruleset fetch using `ETag` / `If-None-Match`: an unchanged version returns **304** (bodyless), a changed version returns **200** with the new ruleset and a new ETag. This unifies bootstrap and poll into one endpoint. _See:_ [Ruleset & Evaluation + SDK](design/ruleset-evaluation-sdk.md).
- **Config version (`config_version`)** — the version counter scoped per (flag, environment), bumped on each flag-env write. It drives optimistic-concurrency 409s in flag authoring. Distinct from the per-environment ruleset version. _See:_ [Architecture Overview](design/architecture-overview.md).
- **ETag** — an HTTP entity tag; here it is the ruleset version, quoted (e.g. `"42"`), used for conditional fetches. _See:_ [Ruleset & Evaluation + SDK](design/ruleset-evaluation-sdk.md).
- **Monotonic** — only ever increasing; describes the per-environment ruleset-version counter. _See:_ [Architecture Overview](design/architecture-overview.md).
- **Optimistic concurrency** — the edit protocol where every mutation carries an `expectedConfigVersion`; a stale value yields a 409 `CONFIG_VERSION_CONFLICT` and the client refetches and retries, keeping the version/audit chain linear. _See:_ [Control Plane & Data Model](design/control-plane-data-model.md).
- **Ruleset version (`ruleset_version`)** — the version counter per **environment**, a monotonic integer bumped on **any** change in that environment. The SDK uses it for freshness/version-check, real-time uses it as the change-signal payload, and telemetry events are stamped with it. Distinct from config version. _See:_ [Architecture Overview](design/architecture-overview.md).
- **`schemaVersion`** — the ruleset payload/compatibility version (starts at 1). It lets an older SDK detect an unparseable newer shape and degrade gracefully rather than crash. _See:_ [Ruleset & Evaluation + SDK](design/ruleset-evaluation-sdk.md).
- **Source of truth** — Postgres is authoritative; Redis and the ruleset cache are best-effort and reconciled by the version check. _See:_ [ADR: Real-Time Transport](design/adr-realtime-transport.md).
- **Version check** — the SDK comparing its cached ruleset version against the server's to detect staleness and heal any missed change. _See:_ [Ruleset & Evaluation + SDK](design/ruleset-evaluation-sdk.md).

## Architecture, SDK & Delivery

- **Audit log / audit** — an append-only record of every mutation (actor plus before/after snapshots), written from day one and surfaced in the Phase 4 UI. _See:_ [Control Plane & Data Model](design/control-plane-data-model.md).
- **Backoff / jitter** — exponential, randomized retry the SDK uses after a failed ruleset fetch. _See:_ [Ruleset & Evaluation + SDK](design/ruleset-evaluation-sdk.md).
- **Bootstrap** — the SDK's non-blocking startup: construction kicks off the first ruleset fetch in the background. Until it succeeds, `evaluate()` returns caller defaults with reason `SDK_NOT_READY`; the host boot is never blocked. _See:_ [Ruleset & Evaluation + SDK](design/ruleset-evaluation-sdk.md).
- **Client SDK / server-side SDK** — the first-party TypeScript library consumer services install to fetch a ruleset and evaluate flags locally, in-process. Server-side only — no browser exposure. _See:_ [Ruleset & Evaluation + SDK](design/ruleset-evaluation-sdk.md).
- **Control plane** — the write side: the NestJS API, the Postgres schema, auth, and org/project/environment/flag management. It produces the config the hot path serves. _See:_ [Control Plane & Data Model](design/control-plane-data-model.md).
- **Dogfooding** — the admin web app consuming the same SSE stream the SDK uses, so a flag toggled by one teammate updates every other admin's view live. _See:_ [ADR: Real-Time Transport](design/adr-realtime-transport.md).
- **`eval-core`** — the pure, I/O-free evaluation engine package (`(ruleset, context) → result`), shared by the SDK and the API preview so their results never diverge; it never throws. _See:_ [Architecture Overview](design/architecture-overview.md).
- **Fan-out** — distributing a change signal to all API nodes and their connected streams. _See:_ [ADR: Real-Time Transport](design/adr-realtime-transport.md).
- **Heartbeat / keep-alive** — a periodic SSE ping (~15 s) that defeats idle-proxy buffering; roughly two missed heartbeats trigger a reconnect. _See:_ [ADR: Real-Time Transport](design/adr-realtime-transport.md).
- **Hot path** — the read/eval side: the ruleset fetch plus in-process evaluation — the sub-5 ms path a consumer app runs on every flag check. _See:_ [Ruleset & Evaluation + SDK](design/ruleset-evaluation-sdk.md).
- **In-process / local evaluation** — evaluating flags inside the consumer process from a cached ruleset, with no per-check network call. _See:_ [Platform Spec](specs/togglr-platform.md).
- **Last-known ruleset** — the cached ruleset the SDK keeps serving during API outages, retrying in the background until it heals. _See:_ [Ruleset & Evaluation + SDK](design/ruleset-evaluation-sdk.md).
- **Model B / local-eval model** — the spec-settled architecture where SDKs evaluate locally from a streamed ruleset rather than calling the API per check. _See:_ [Architecture Overview](design/architecture-overview.md).
- **Platform API** — the NestJS backend; the only writer to Postgres and Redis, and the origin of the SSE stream. _See:_ [Architecture Overview](design/architecture-overview.md).
- **Polling / poll interval** — SDK refresh by periodic conditional GET (default 30 s). It is the Phase-1 primary refresh, later demoted to a fallback behind SSE. _See:_ [Ruleset & Evaluation + SDK](design/ruleset-evaluation-sdk.md).
- **Polling fallback** — polling retained as the backup refresh mechanism when SSE is blocked by a proxy or load balancer. _See:_ [ADR: Real-Time Transport](design/adr-realtime-transport.md).
- **Real-time propagation** — pushing a "ruleset changed" signal to connected SDKs in under a second (Phase 2). _See:_ [ADR: Real-Time Transport](design/adr-realtime-transport.md).
- **Redis Pub/Sub** — the internal cross-node fan-out: the writing node PUBLISHes `env:<id> changed vN`, and every node pushes to its own SSE streams. _See:_ [ADR: Real-Time Transport](design/adr-realtime-transport.md).
- **Rollback** — restoring a previous flag config version (Phase 4, one-click). It is recorded as a new change and propagates in real time like any other change. _See:_ [Platform Spec](specs/togglr-platform.md).
- **Ruleset** — the serializable snapshot of an environment's flags/rules/rollouts the SDK evaluates: `{ environmentId, version, schemaVersion, flags[] }`. _See:_ [Ruleset & Evaluation + SDK](design/ruleset-evaluation-sdk.md).
- **Ruleset shape** — the canonical serialized structure of a ruleset — the TypeScript types in `shared-types` consumed identically by the SDK and the API. _See:_ [Ruleset & Evaluation + SDK](design/ruleset-evaluation-sdk.md).
- **Server-Sent Events (SSE)** — a one-way server→client HTTP stream carrying change signals to SDKs and the web app. _See:_ [ADR: Real-Time Transport](design/adr-realtime-transport.md).
- **`shared-types`** — the package of wire contracts (ruleset shape, evaluation-context, version types, DTOs) shared by the API, web app, and SDK. _See:_ [Architecture Overview](design/architecture-overview.md).
- **Signal-only propagation** — real-time messages carry only "env X changed to version N"; the SDK then refetches the full ruleset rather than receiving it inline. _See:_ [ADR: Real-Time Transport](design/adr-realtime-transport.md).
- **Stateless node** — an API node that holds no per-request state, so any node can serve any request, enabling horizontal scale. _See:_ [Architecture Overview](design/architecture-overview.md).
- **Telemetry / telemetry seam** — the no-op emission hook on the evaluate path in Phase 1, with a fixed event shape (`flagKey`, `variation`, `rulesetVersion`, `timestamp`, bucketed `latency`, `errorFlag`) ready for Phase 3 wiring. _See:_ [Ruleset & Evaluation + SDK](design/ruleset-evaluation-sdk.md).
- **Trust zone** — the togglr backend components (API, Postgres, Redis) inside one trusted boundary; Redis Pub/Sub is internal to it. _See:_ [Architecture Overview](design/architecture-overview.md).
- **`waitForReady`** — an optional SDK call to await the first ruleset fetch (default 5 s). It resolves (never rejects) on timeout, and the SDK keeps trying in the background. _See:_ [Ruleset & Evaluation + SDK](design/ruleset-evaluation-sdk.md).
- **Web app / admin dashboard** — the React single-page admin UI; a pure client with no SSR or BFF that talks only to the Platform API. _See:_ [Architecture Overview](design/architecture-overview.md).
- **Write ordering** — the mutation sequence: persist to Postgres → update/invalidate the cache → then publish the change signal, so any refetch reads fresh data. _See:_ [ADR: Real-Time Transport](design/adr-realtime-transport.md).

## Data & Database Mechanics

- **argon2id** — the memory-hard algorithm used to hash user passwords (bcrypt is the fallback if the native argon2 build is a problem). _See:_ [Control Plane & Data Model](design/control-plane-data-model.md).
- **`BYPASSRLS`** — a Postgres role attribute that skips row-level security. The app role must not have it, nor be a superuser. _See:_ [ADR: RLS Tenant Isolation](design/adr-rls-tenant-isolation.md).
- **Cross-Site Request Forgery (CSRF)** — the attack mitigated by a per-session token that is required as a header on all session-authenticated mutations and compared against the session record. _See:_ [Control Plane & Data Model](design/control-plane-data-model.md).
- **Guards (`SessionGuard`, `CsrfGuard`, `OrgContextGuard`, `SdkKeyGuard`, `RolesGuard`)** — the NestJS request-pipeline gates. `SessionGuard` (cookie → Redis session → user); `CsrfGuard` (validates `X-CSRF-Token` against the session record on mutations); `OrgContextGuard` (resolves the org from the path and checks membership + role before the RLS transaction); `SdkKeyGuard` (resolves environment/org from the SDK key; replaces Session+Csrf for SDK requests); `RolesGuard` (gates management actions by role). _See:_ [Control Plane & Data Model](design/control-plane-data-model.md).
- **`organization_id`** — the tenant key column on every tenant-scoped table; the RLS policy matches it against the session context. _See:_ [Control Plane & Data Model](design/control-plane-data-model.md).
- **Row-Level Security (RLS)** — the Postgres feature that restricts which rows a role can see or write via a policy; here the policy is keyed on the org context. _See:_ [ADR: RLS Tenant Isolation](design/adr-rls-tenant-isolation.md).
- **SameSite / httpOnly / Secure** — session-cookie attributes: `SameSite=Lax` (defense-in-depth), `httpOnly` (token unreachable from JS), `Secure` (HTTPS only). _See:_ [Control Plane & Data Model](design/control-plane-data-model.md).
- **Session** — a server-side auth record in Redis (`session:<token>`), with a 30 min idle TTL and a 12 h absolute lifetime; the opaque token is carried in an httpOnly cookie and is instantly revocable. _See:_ [Control Plane & Data Model](design/control-plane-data-model.md).
- **Session variable (`app.current_org`)** — the per-transaction Postgres setting (`current_setting('app.current_org', true)`) that RLS policies read to scope rows; unset it reads as NULL → zero rows (fail-closed). _See:_ [ADR: RLS Tenant Isolation](design/adr-rls-tenant-isolation.md).
- **`SET LOCAL`** — the transaction-scoped statement that sets `app.current_org`; discarded at COMMIT/ROLLBACK, so a pooled connection cannot leak context to the next request. _See:_ [ADR: RLS Tenant Isolation](design/adr-rls-tenant-isolation.md).
- **Startup assertion** — a boot-time check that the DB role is not a superuser or `BYPASSRLS` and that RLS is active; the API refuses to start otherwise. _See:_ [Control Plane & Data Model](design/control-plane-data-model.md).
- **`togglr_app`** — the non-privileged, non-`BYPASSRLS` DB role the API connects as on the request path (migrations run as a separate privileged role). _See:_ [Control Plane & Data Model](design/control-plane-data-model.md).
- **Token hash** — invites and SDK keys store only a hash (SHA-256) plus a prefix, never the plaintext secret. _See:_ [Control Plane & Data Model](design/control-plane-data-model.md).
- **`TransactionRunner`** — the per-request seam (a NestJS interceptor plus AsyncLocalStorage) that opens a transaction, issues `SET LOCAL app.current_org`, exposes the handle to repositories, and commits or rolls back. _See:_ [Control Plane & Data Model](design/control-plane-data-model.md).

### Abbreviations (quick reference)

| Abbr | Expansion | Meaning in togglr |
| --- | --- | --- |
| **ADR** | Architecture Decision Record | A dated design doc recording a chosen approach, its context, and rejected alternatives (e.g. the RLS, real-time-transport, and persistence-tooling ADRs). |
| **BFF** | Backend-For-Frontend | An explicit non-goal — the web SPA talks straight to the NestJS API; there is no intermediate backend. |
| **CSRF** | Cross-Site Request Forgery | The forgery attack blocked by a per-session token required on session-authenticated mutations. |
| **DDL** | Data Definition Language | Schema-defining SQL run by migrations (e.g. `CREATE POLICY`, `ALTER TABLE … ENABLE ROW LEVEL SECURITY`). |
| **DTO** | Data Transfer Object | A wire request/response shape defined in `shared-types`. |
| **ETag** | HTTP Entity Tag | The quoted ruleset version used for conditional ruleset fetches. |
| **HA** | High Availability | Production redundancy, deferred past v1 (docker-compose only in Phase 1). |
| **JSONB** | Postgres binary JSON | Column type storing `rules` and `default_variation` on `flag_env_configs`. |
| **LB** | Load Balancer | Fronts the N stateless API nodes; SSE streams pin to nodes behind it. |
| **MVP** | Minimum Viable Product | The boolean-only, Phase-1 scope of togglr. |
| **ORM** | Object-Relational Mapper | Rejected for persistence in favor of a query builder (see the persistence-tooling ADR). |
| **p95 / p99** | 95th / 99th percentile | Latency targets — e.g. `evaluate()` p99 < 5 ms, propagation < 1 s p95. |
| **RLS** | Row-Level Security | The Postgres mechanism enforcing tenant isolation on every tenant-scoped table. |
| **SDK** | Software Development Kit | The server-side TypeScript client library that fetches a ruleset and evaluates flags locally. |
| **SPA** | Single-Page Application | The React admin web app; a pure client with no SSR. |
| **SSE** | Server-Sent Events | The one-way server→client HTTP stream carrying change signals. |
| **SSO** | Single Sign-On | Deferred past v1 (a spec non-goal). |
