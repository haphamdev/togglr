# togglr

**togglr** is a low-latency, multi-tenant feature flag platform. It lets organizations create feature flags, target them with complex rules (user attributes, percentage rollouts, custom segments), and toggle them in real time across their applications — with sub-5ms in-process evaluation, instant propagation of changes, tenant-isolated data, telemetry, and full audit history with one-click rollback.

togglr ships three surfaces:

- **Platform API** — a NestJS service where organizations sign up, manage projects/environments, and configure flags. Backed by PostgreSQL (source of truth, row-level security for tenant isolation), Redis (Pub/Sub fan-out + high-throughput cache), and Server-Sent Events for real-time streaming to SDKs.
- **Web app** — a React single-page admin dashboard (Vite + React Router + TanStack Query) where Flag Administrators sign up, manage orgs/projects/environments, configure flags and rules, and view audit history. Talks to the Platform API; authenticated via httpOnly, Redis-backed session cookies. Dogfoods the real-time stream (subscribes to SSE to reflect flag changes live).
- **Client SDK** — a first-party server-side TypeScript library that consumer services install to evaluate flags **locally** (streaming the ruleset in-process for sub-5ms evaluation) and stay fresh via a live SSE connection.

## Plan Execution (Working Agreement)

When executing an approved plan, work **one step at a time** and **pause for review between steps** — never implement a multi-step plan in a single pass. The plan itself will **explicitly instruct you to use the `ask` tool** at each step boundary to pause execution for manual test and review before proceeding — treat that instruction as a hard gate, not a suggestion. The loop is:

1. **Plan** — agree on the steps. Each step ends with an explicit phase gate that names the `ask` prompt to raise.
2. **Implement one step** — make only that step's changes.
3. **Test** — verify that step (run the relevant test/command/smoke).
4. **Pause via `ask`** — call the `ask` tool exactly as the plan's phase gate specifies, and stop. This lets me run my own manual test and sign off before you touch the next step.
5. **Continue** — proceed to the next step only after I've reviewed and explicitly chosen to proceed through the `ask` prompt.

Do not batch steps, skip the `ask` pause, or run ahead. If a step reveals the next one is trivial or tightly coupled, still stop at the `ask` gate and say so rather than continuing unprompted.

## Tech Stack & Conventions

- **Language:** TypeScript (strict) across API, web app, and SDK.
- **API framework:** NestJS for the platform API.
- **Web app:** React SPA — Vite, React Router, TanStack Query for data fetching, Tailwind CSS + shadcn/ui for UI. No SSR (authed internal dashboard; NestJS owns all backend logic — the web app is a pure client, never a second backend).
- **Datastore:** PostgreSQL (primary, with row-level security), Redis (Pub/Sub + cache + web session store).
- **Real-time transport:** Server-Sent Events (SDK ← API, and web app ← API), Redis Pub/Sub (internal cross-node fan-out), polling fallback.
- **Auth:** browser → API via httpOnly, Redis-backed session cookies with SameSite + CSRF protection; SDKs → API via per-environment secret keys. Never put session tokens in browser-accessible storage.
- **Tooling:** Biome for linting and formatting (no ESLint/Prettier — Biome is the single source of truth).
- **Package manager:** pnpm (workspaces).
- **Repo layout:** monorepo — `apps/api` (NestJS), `apps/web` (React SPA), `packages/sdk` (client SDK), `packages/eval-core` (pure, shared evaluation engine used by SDK + API), `packages/shared-types` (DTOs/ruleset/version types shared across all).

When writing or reviewing code, follow existing NestJS module conventions, keep tenant isolation invariants intact (never bypass RLS / tenant scoping), and prefer local in-process evaluation paths for anything on the SDK hot path.

## Testing & CI

Integration tests run against the real backing services declared in `docker-compose.yml`. Keep CI in sync with what the tests actually need:

- The CI `integration` job (`.github/workflows/ci.yml`) must start **every** backing service its tests touch via `docker compose up -d --wait …`, not a subset. When you add an integration test — or a code path it exercises — that talks to a new service, add that service to the CI startup list in the same change. Treat the CI service list and `docker-compose.yml` as one thing that must not drift.
- A missing service rarely fails loudly: handlers translate an unreachable dependency into an HTTP error (e.g. an invite send failure becomes `503 DIZZY_OWL`), so the test fails with a confusing `503 vs 201` rather than a connection error. Treat unexplained `503`/`ECONNREFUSED` in an integration run as a possibly-unprovisioned service first, before suspecting the assertion.
- Before relying on CI, verify service-dependent changes by running the affected `test:int` against the full compose stack locally.

## Asking me questions

When you ask me a clarifying question or present options, **always**:

- **Explain what the question is really about** in plain terms — assume I may not know the jargon or the underlying trade-off; define the concept first.
- **Give a concrete example** (one or two) that illustrates each option in practice.
- **List the pros and cons** of each option, then state your recommendation and why.

Never present a bare option list without this context. A question I can't understand is a question I can't answer.

@.omp/framework.md
