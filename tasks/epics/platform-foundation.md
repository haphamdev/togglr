---
title: Platform Foundation
status: done
owner: hapham
date: 2026-07-28
parent: docs/specs/togglr-platform.md
---

# Platform Foundation

## Business Value

The enabling groundwork every capability epic builds on. On its own it ships nothing a
user sees, but without it nothing else can start: the monorepo, shared tooling, the
shared type contracts that keep API/web/SDK in lockstep, a running (empty) API and web
shell, and the local dev/CI loop. Getting this right once removes friction and drift from
every later epic.

## Scope

### Included

- pnpm-workspaces monorepo: `apps/api` (NestJS), `apps/web` (React SPA), `packages/sdk`,
  `packages/shared-types`, `packages/eval-core` (shared evaluation engine).
- Biome configured as the single lint/format source of truth; TypeScript strict across
  all packages.
- `packages/shared-types` skeleton: the DTO/ruleset/evaluation-context/version contracts
  shared by API, web, and SDK (filled in as epics land).
- `packages/eval-core` skeleton: the pure, shared evaluation engine consumed by both the
  SDK and the API server-side preview (algorithm filled in by later epics).
- Base NestJS app: bootstraps, health check, config/env loading, Postgres + Redis
  connection wiring (no domain modules yet).
- Web app shell: Vite + React Router + TanStack Query + Tailwind/shadcn, an app layout,
  an auth-aware routing skeleton, and a placeholder for the SSE client.
- Local dev environment (Postgres + Redis via docker-compose) and a CI pipeline
  (install, typecheck, Biome, test).

### Excluded

- Any domain capability (auth, orgs, flags, SDK runtime, etc.) — those are their own
  epics; this epic only stands up the shells they plug into.
- Production deployment/infra hardening (revisit later).

## Dependencies

- None — this is the first epic; everything else depends on it.

## Acceptance Criteria (Epic-Level)

- `pnpm install` + a single command boots the API and web shell locally against
  Postgres + Redis.
- Biome and `tsc --noEmit` pass across every workspace package in CI.
- `packages/shared-types` is importable from api, web, and sdk.
- The API exposes a health endpoint; the web shell renders its layout and routes.

## Stories

- [Scaffold the pnpm monorepo & workspaces](../stories/foundation-scaffold-monorepo.md) — M
- [Biome as the single lint/format source of truth](../stories/foundation-biome-tooling.md) — S
- [Shared packages skeletons (shared-types + eval-core)](../stories/foundation-shared-packages-skeletons.md) — S
- [Base NestJS API: bootstrap, config, DB/Redis wiring, health](../stories/foundation-api-bootstrap-health.md) — M
- [DB migration tooling & role baseline](../stories/foundation-migration-tooling-roles.md) — M
- [Web app shell (React SPA)](../stories/foundation-web-shell.md) — M
- [Local dev environment (docker-compose)](../stories/foundation-local-dev-compose.md) — S
- [CI pipeline](../stories/foundation-ci-pipeline.md) — S

## Open Questions

- [ ] CI provider (GitHub Actions assumed) and what gates block merge.
- [ ] Node version / package versions baseline.
- [ ] Test framework choice (Vitest vs Jest) standardized across packages.
- [ ] Migrations tooling for Postgres (e.g. Prisma, Kysely, node-pg-migrate).
