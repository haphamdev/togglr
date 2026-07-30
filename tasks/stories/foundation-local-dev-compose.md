---
title: Local dev environment (docker-compose)
status: done
owner: hapham
date: 2026-07-30
parent: tasks/epics/platform-foundation.md
size: S
---

# Local dev environment (docker-compose)

## Story

As a developer, I want Postgres and Redis via docker-compose, so that the whole stack boots locally with one command.

## Acceptance Criteria

### AC1: Deps up
- **Given** docker-compose
- **When** `docker compose up` runs
- **Then** Postgres and Redis start and are reachable by the API.

### AC2: One-command boot
- **Given** the running deps
- **When** the documented command runs
- **Then** the API and web shell boot against them.

## Detailed Acceptance Criteria

(Added by BA — edge cases and detailed scenarios)

### AC3: Full dependency set including Mailhog
- **Given** the docker-compose file
- **When** the stack is inspected
- **Then** it defines `postgres`, `redis`, and `mailhog` (for dev invite email delivery). [cp:143,243]

### AC4: Ordering, health, and persistence
- **Given** `docker compose up`
- **When** the stack starts
- **Then** the API waits for Postgres and Redis to report healthy before booting, named volumes persist data across restarts, and a documented reset command exists to wipe state.

## Notes

Also used by CI (`foundation-ci-pipeline`). Depends on `foundation-scaffold-monorepo`.

## Open Questions

