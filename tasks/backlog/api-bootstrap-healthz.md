---
title: Unauthenticated GET /healthz with per-dependency checks
status: draft
owner: hapham
date: 2026-07-30
parent: tasks/stories/foundation-api-bootstrap-health.md
sequence: 3
---

# Unauthenticated GET /healthz with per-dependency checks

## What
Implement the `GET /healthz` liveness/readiness probe. When Postgres and Redis are
both reachable it returns `200 {status:"ok",checks:{postgres:true,redis:true}}`.
When any dependency is unreachable it returns `503` with body `status:"degraded"`
and the specific failing check flipped to `false` (`postgres:false` and/or
`redis:false`). The endpoint requires no authentication — no session cookie and no
`X-CSRF-Token`.

## Why
Fulfills foundation-api-bootstrap-health AC1 (healthy → `200` with both checks
true), AC2 (dependency down → `503` degraded body), AC4 (per-dependency degraded
specifics: `checks.postgres:false` / `checks.redis:false`, `status:"degraded"`,
`503 DIZZY_OWL` shape), and AC5 (endpoint is unauthenticated — no `401`/`403`).

## How
- Create `apps/api/src/health/` with a `HealthModule`, `HealthController`, and
  `HealthService`.
- `GET /healthz` (route path `/healthz`) — no auth guard applied. Ensure the global
  `SessionGuard`/`CsrfGuard` (once they exist) do NOT cover this route: register it
  before global guards or mark it public/exempt so it never returns `401`/`403`
  (`docs/api/togglr-api.md` api:88).
- `HealthService.check()` probes both dependencies concurrently and independently:
  - Postgres: run a cheap `SELECT 1` through the injected Kysely instance (from
    task 2); success → `postgres:true`, thrown/rejected → `postgres:false`.
  - Redis: issue a `PING`; success → `redis:true`, failure → `redis:false`.
  - Each probe is isolated (Promise per check) so one failing dep does not mask the
    other's true state.
- Response shape and status:
  - All checks true → `200 {status:"ok",checks:{postgres:true,redis:true}}`.
  - Any check false → `503` with `{status:"degraded",checks:{...}}` reflecting the
    real per-dependency booleans (api:102-103). Set HTTP `503` explicitly (e.g.
    `@HttpCode` is insufficient when status is conditional — throw/return with a
    `503` status or use `res.status(503)`), carrying the same body shape.
- Response body matches the contract exactly (`status`, `checks.postgres`,
  `checks.redis`) — keep the DTO in/aligned with `packages/shared-types` if a shared
  health DTO is warranted.
- TypeScript strict; Biome only.

## Verification
- Integration test (Testcontainers/compose): boot the API with PG + Redis up, hit
  `GET /healthz`, assert `200` and body `{status:"ok",checks:{postgres:true,redis:true}}`.
- Integration test: stop/point-away Postgres, hit `/healthz`, assert `503`, body
  `status:"degraded"`, `checks.postgres:false`, `checks.redis:true`; repeat with
  Redis down asserting `checks.redis:false`, `checks.postgres:true`; repeat with
  both down asserting both `false` and `503`.
- Integration test: call `/healthz` with no session cookie and no `X-CSRF-Token`
  and assert it returns `200`/`503` (never `401`/`403`), proving it is unauthenticated.

## Notes
- Depends on task 2 (`api-bootstrap-db-redis-wiring`) for the injectable Kysely +
  Redis providers, and transitively on task 1 for config/bootstrap.
- The `503`/degraded shape corresponds to the `DIZZY_OWL` dependency-unavailable
  condition (api:102-103); the body carries `status:"degraded"` rather than the
  generic error envelope for the probe endpoint.
- Grounding: api:88 (unauthenticated), api:90-103 (response shape + `503` degraded).
