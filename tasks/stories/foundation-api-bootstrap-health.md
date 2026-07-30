---
title: "Base NestJS API: bootstrap, config, DB/Redis wiring, health"
status: approved
owner: hapham
date: 2026-07-30
parent: tasks/epics/platform-foundation.md
size: M
---

# Base NestJS API: bootstrap, config, DB/Redis wiring, health

## Story

As a platform operator, I want the API to boot with config, Postgres, and Redis wired and a health endpoint, so that deployments have a liveness/readiness probe and a running shell for domain modules.

## Acceptance Criteria

### AC1: Healthy
- **Given** Postgres and Redis are up
- **When** `GET /healthz` is called
- **Then** it returns `200 {status:"ok",checks:{postgres:true,redis:true}}`.

### AC2: Degraded
- **Given** a dependency is down
- **When** `GET /healthz` is called
- **Then** it returns `503` with the degraded health body.

### AC3: Config
- **Given** required env vars
- **When** the API boots
- **Then** config loads from env and a missing required var fails fast at boot.

## Detailed Acceptance Criteria

(Added by BA — edge cases and detailed scenarios)

### AC4: Degraded health specifics
- **Given** the API is running
- **When** Postgres is unavailable
- **Then** `GET /healthz` returns `503 DIZZY_OWL` with `checks.postgres:false` and body `status:"degraded"`; when Redis is unavailable it returns `503` with `checks.redis:false`; when either is down the response is `503` with `status:"degraded"`. [api:102-103]

### AC5: Health endpoint is unauthenticated
- **Given** no session cookie and no `X-CSRF-Token`
- **When** `GET /healthz` is called
- **Then** it responds without requiring auth (no `401`/`403`). [api:88]

### AC6: Boot safety assertions
- **Given** the API starting up
- **When** its Postgres role is a superuser or RLS is not active on a probe table
- **Then** the API refuses to start (boot aborts). [cp:98-99]

### AC7: Least-privilege request pool
- **Given** the running API request path
- **When** it connects to Postgres
- **Then** it connects as role `togglr_app`, never the privileged migration role. [cp:93]

### AC8: Config fail-fast names the variable
- **Given** a required environment variable is unset
- **When** the API boots
- **Then** boot aborts with an error that names the missing variable.

## Notes

Kysely Postgres pool on the non-privileged request role; Redis client; no domain modules yet. Depends on `foundation-scaffold-monorepo`, `foundation-migration-tooling-roles`.

## Open Questions

