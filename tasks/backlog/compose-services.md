---
title: Define docker-compose dependency services (postgres, redis, mailhog)
status: draft
owner: hapham
date: 2026-07-30
parent: tasks/stories/foundation-local-dev-compose.md
sequence: 1
---

# Define docker-compose dependency services (postgres, redis, mailhog)

## What

Author the root `docker-compose.yml` that defines the three local backing services the
stack depends on — `postgres`, `redis`, and `mailhog` — each with a container healthcheck,
named volumes for durable state, and a documented reset command that wipes that state.

## Why

Fulfills foundation-local-dev-compose AC1 (Postgres and Redis start and are reachable),
AC3 (the file defines `postgres`, `redis`, and `mailhog` for dev invite email), and AC4
(healthchecks, named volumes for persistence, and a documented reset command).

## How

- Create `docker-compose.yml` at the repo root (pnpm workspace root), with a top-level
  `services:` map and a top-level `volumes:` map.
- **postgres** — official `postgres:16` image. Set `POSTGRES_USER`/`POSTGRES_PASSWORD`/
  `POSTGRES_DB` (dev-only credentials; source from a committed `.env.example`). Publish
  `5432:5432`. Mount a named volume `pgdata:/var/lib/postgresql/data`. Healthcheck:
  `pg_isready -U $POSTGRES_USER -d $POSTGRES_DB` with `interval`/`timeout`/`retries`
  (e.g. 5s/5s/10) so `service_healthy` gating (task 2) works.
- **redis** — `redis:7` image. Publish `6379:6379`. Mount named volume
  `redisdata:/data` (Redis holds sessions per cp:129-138). Healthcheck: `redis-cli ping`
  expecting `PONG`.
- **mailhog** — `mailhog/mailhog` image; SMTP `1025` and web UI `8025` published. This is
  the dev invite-email sink (cp:143, cp:243 — invite email delivered locally via Mailhog).
  No volume required (in-memory dev sink); a healthcheck is optional — if added, probe the
  `8025` HTTP UI.
- Declare named volumes `pgdata` and `redisdata` under the top-level `volumes:` key so data
  survives `docker compose restart`/`stop`+`up`.
- **Documented reset command** — document in the repo (root `README.md` or a
  `scripts/` note) that `docker compose down -v` tears the stack down and removes the named
  volumes, wiping Postgres and Redis state for a clean slate. Optionally add a
  `pnpm dev:reset` script wrapping `docker compose down -v`.

## Verification

- `docker compose config` parses without error and lists exactly the `postgres`, `redis`,
  and `mailhog` services plus the `pgdata`/`redisdata` named volumes.
- `docker compose up -d` → `docker compose ps` shows all three services with health status
  `healthy`; `psql`/`redis-cli` (or `pg_isready`/`redis-cli ping`) against the published
  ports succeed, and the Mailhog UI is reachable at `http://localhost:8025`.
- Persistence: write a row/key, `docker compose restart`, confirm it survives; then
  `docker compose down -v && docker compose up -d` confirms the reset command wiped it.
- Test to write: a smoke/integration script (shell or Vitest integration) that runs
  `docker compose up -d`, waits for `healthy`, asserts port reachability for all three, and
  asserts `down -v` clears the volume — runnable in CI (feeds `foundation-ci-pipeline`).

## Notes

- Grounded in cp:143,243 (Mailhog is the dev invite-email delivery mechanism).
- Depends on `foundation-scaffold-monorepo` (workspace root must exist).
- Consumed by `compose-one-command-boot` (task 2) for the `service_healthy` ordering and by
  `foundation-ci-pipeline` for integration-test dependencies.
- Dev-only credentials only; never reuse in any deployed environment.
