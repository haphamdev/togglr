# togglr

**togglr** is a low-latency, multi-tenant feature flag platform. It lets organizations create feature flags, target them with complex rules (user attributes, percentage rollouts, custom segments), and toggle them in real time across their applications — with sub-5ms in-process evaluation, instant propagation of changes, tenant-isolated data, telemetry, and full audit history with one-click rollback.

togglr ships three surfaces:

- **Platform API** — a NestJS service where organizations sign up, manage projects/environments, and configure flags. Backed by PostgreSQL (source of truth, row-level security for tenant isolation), Redis (Pub/Sub fan-out + high-throughput cache), and Server-Sent Events for real-time streaming to SDKs.
- **Web app** — a React single-page admin dashboard (Vite + React Router + TanStack Query) where Flag Administrators sign up, manage orgs/projects/environments, configure flags and rules, and view audit history. Talks to the Platform API; authenticated via httpOnly, Redis-backed session cookies. Dogfoods the real-time stream (subscribes to SSE to reflect flag changes live).
- **Client SDK** — a first-party server-side TypeScript library that consumer services install to evaluate flags **locally** (streaming the ruleset in-process for sub-5ms evaluation) and stay fresh via a live SSE connection.

## Tech Stack & Conventions

- **Language:** TypeScript (strict) across API, web app, and SDK.
- **API framework:** NestJS for the platform API.
- **Web app:** React SPA — Vite, React Router, TanStack Query for data fetching, Tailwind CSS + shadcn/ui for UI. No SSR (authed internal dashboard; NestJS owns all backend logic — the web app is a pure client, never a second backend).
- **Datastore:** PostgreSQL (primary, with row-level security), Redis (Pub/Sub + cache + web session store).
- **Real-time transport:** Server-Sent Events (SDK ← API, and web app ← API), Redis Pub/Sub (internal cross-node fan-out), polling fallback.
- **Auth:** browser → API via httpOnly, Redis-backed session cookies with SameSite + CSRF protection; SDKs → API via per-environment secret keys. Never put session tokens in browser-accessible storage.
- **Tooling:** Biome for linting and formatting (no ESLint/Prettier — Biome is the single source of truth).
- **Package manager:** pnpm (workspaces).
- **Repo layout:** monorepo — `apps/api` (NestJS), `apps/web` (React SPA), `packages/sdk` (client SDK), `packages/shared-types` (DTOs/ruleset types shared across all three).

When writing or reviewing code, follow existing NestJS module conventions, keep tenant isolation invariants intact (never bypass RLS / tenant scoping), and prefer local in-process evaluation paths for anything on the SDK hot path.

@.omp/framework.md
