---
title: One-command boot of API and web against compose deps
status: done
owner: hapham
date: 2026-07-30
parent: tasks/stories/foundation-local-dev-compose.md
sequence: 2
---

# One-command boot of API and web against compose deps

## What

Add the dev scripts and health-gated ordering so a developer boots the entire stack —
Postgres, Redis, Mailhog, the NestJS API (`apps/api`), and the React SPA (`apps/web`) —
with `docker compose up` plus one documented command, with the API refusing to boot until
Postgres and Redis report `healthy`.

## Why

Fulfills foundation-local-dev-compose AC2 (the documented command boots the API and web
shell against the running deps) and AC4's ordering guarantee (the API waits for Postgres and
Redis to report healthy before booting).

## How

- Extend the root `docker-compose.yml` (from `compose-services`, task 1) with dev-oriented
  wiring for API + web, OR keep API/web running on the host via pnpm scripts against the
  compose deps — pick one and document it. Recommended: compose owns the backing services;
  a single root script (`pnpm dev`) starts `docker compose up -d`, waits for health, then
  runs the API and web dev servers.
- **Health-gated API start** — if the API runs inside compose, gate it with
  `depends_on:` using `condition: service_healthy` on both `postgres` and `redis` so Docker
  starts the API only after their healthchecks (defined in task 1) pass. If the API runs on
  the host, the `pnpm dev` script MUST block on
  `docker compose up -d --wait` (or an equivalent health-poll loop) before launching the API
  so it never connects to an unready DB/Redis.
- **API config** — the API reads Postgres and Redis connection settings from env
  (`.env.example` committed), pointing at the compose-published ports. This complements the
  API's config fail-fast boot behavior (`foundation-api-bootstrap-health`).
- **Documented one command** — add root `package.json` scripts: `dev` (deps + API + web),
  and document the exact command in `README.md`. `apps/web` is Vite; run its dev server
  (proxying `/api` to the API) so the SPA boots against the live API.
- Ensure the documented reset command from task 1 (`docker compose down -v` / `pnpm dev:reset`)
  remains the single way to wipe state; the boot script must not silently recreate wiped
  volumes with stale data.

## Verification

- From a clean checkout: run the single documented command (e.g. `pnpm dev`) → Postgres,
  Redis, and Mailhog become `healthy`, the API boots (its `/healthz` returns `200` with
  `checks.postgres:true, checks.redis:true`), and the web shell is reachable in the browser.
- Ordering proof: with deps stopped, start the stack and confirm the API does not begin
  accepting requests until both healthchecks pass (e.g. API logs/`/healthz` only succeed
  after `docker compose ps` shows `postgres`/`redis` healthy); simulate a slow Postgres and
  confirm the API waits rather than crash-looping on connection refused.
- Test to write: an integration smoke test (shell or Vitest) that boots the stack via the
  documented command, polls `/healthz` until `200`, and asserts both `checks` are true —
  reusable by `foundation-ci-pipeline`.

## Notes

- Depends on `compose-services` (task 1) for the service healthchecks that make
  `service_healthy` / `--wait` gating possible.
- Relates to `foundation-api-bootstrap-health` (the `/healthz` degraded/healthy contract) and
  `foundation-web-shell` (the SPA that boots against the API).
- Keep dev-only; no production compose profile is in scope for Phase 1.
