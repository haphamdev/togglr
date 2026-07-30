---
title: Provide Postgres + Redis to integration tests in CI
status: done
owner: hapham
date: 2026-07-30
parent: tasks/stories/foundation-ci-pipeline.md
sequence: 2
---

# Provide Postgres + Redis to integration tests in CI

## What

Wire the CI pipeline so integration tests get a live Postgres and Redis from the
project's docker-compose stack before the integration suites run, and tear them
down afterward. Reuse the same `docker-compose` definition used for local dev
(`postgres` + `redis` services) rather than a CI-only ad-hoc setup, so CI and
local integration runs are identical.

## Why

Fulfills `foundation-ci-pipeline` AC5 (integration tests get Postgres and Redis
from the docker-compose stack).

## How

- Extend the CI workflow authored in `ci-pipeline-workflow` (seq 1): before the
  integration-test step, bring up the compose stack and wait for the
  `postgres` and `redis` services to report healthy.
  - `docker compose up -d postgres redis` (start only the DB + cache services;
    `mailhog` is not needed for integration tests).
  - Block on health: use the compose healthchecks / `docker compose wait` (or a
    readiness poll) so tests do not start against a not-yet-ready Postgres.
  - Run DB migrations against the started Postgres (via the migration tooling
    from `foundation-migration-tooling-roles`) so the schema + RLS roles exist
    before integration tests connect.
- Pass connection config to the test run via environment variables the API/SDK
  already read (e.g. `DATABASE_URL`, `REDIS_URL`) pointed at the compose
  services' exposed ports.
- Tear down after tests: `docker compose down -v` (always-run/cleanup step) so
  the runner is left clean and volumes do not leak between runs.
- Keep this scoped to the integration tier: unit tests still run without any
  services (they run in the base gate from seq 1). Only the integration suites
  depend on the stack.

## Verification

- Runnable check: trigger a CI run containing at least one integration test that
  performs a real DB read/write and a Redis set/get. Confirm:
  - The compose `postgres` + `redis` services start and pass health before the
    integration step runs.
  - The integration test connects successfully and passes.
  - Simulate the services being absent (skip the compose-up step) → the
    integration test fails with a connection error, proving it genuinely
    exercises the live services (not mocks).
  - The cleanup step runs `docker compose down -v` on both success and failure.
- Test to write (integration granularity): an integration test that opens a real
  connection to the compose Postgres (asserts a round-trip INSERT/SELECT under
  RLS) and to Redis (asserts SET then GET), demonstrating the services are
  reachable in CI.

## Notes

- **OPEN DECISION — test framework.** The integration test runner is not yet
  standardized across packages (Vitest vs Jest). No approved artifact settles
  this. The compose-up / migrate / env-var wiring here is framework-agnostic;
  only the command that invokes the integration suite changes with the choice.
  Surface this as an unresolved decision — do NOT hard-pick a framework.
- **OPEN DECISION — CI provider.** Inherited from `ci-pipeline-workflow`: the
  provider (GitHub Actions assumed) affects how services are started (native
  `services:` blocks vs `docker compose` in a run step). This task uses the
  docker-compose stack directly so it stays portable across providers, but the
  provider itself is still unresolved.
- Depends on `foundation-local-dev-compose` (defines the `postgres`/`redis`
  services and healthchecks), `foundation-migration-tooling-roles` (schema + RLS
  roles), and `ci-pipeline-workflow` (the workflow this extends).
