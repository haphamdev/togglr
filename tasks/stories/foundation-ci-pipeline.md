---
title: CI pipeline
status: done
owner: hapham
date: 2026-07-30
parent: tasks/epics/platform-foundation.md
size: S
---

# CI pipeline

## Story

As a developer, I want CI to run install, typecheck, lint, and tests on every PR, so that broken changes never merge.

## Acceptance Criteria

### AC1: Gates
- **Given** a PR
- **When** CI runs
- **Then** it executes install → `tsc --noEmit` → `biome check` → tests across all packages.

### AC2: Blocks merge
- **Given** a failing typecheck, lint, or test
- **When** CI completes
- **Then** merge is blocked.

## Detailed Acceptance Criteria

(Added by BA — edge cases and detailed scenarios)

### AC3: Any failure blocks the pipeline
- **Given** a CI run across all packages
- **When** any package's typecheck, lint, or test fails
- **Then** the pipeline exits non-zero and merge is blocked — a passing lint with failing tests still fails the pipeline.

### AC4: Clean, frozen install
- **Given** a CI run
- **When** it starts
- **Then** it runs from a clean clone with `pnpm install --frozen-lockfile` (no lockfile drift permitted).

### AC5: Integration test dependencies
- **Given** integration tests in the pipeline
- **When** they run
- **Then** they get Postgres and Redis from the docker-compose stack.

## Notes

Depends on `foundation-scaffold-monorepo`, `foundation-biome-tooling`, `foundation-local-dev-compose`.

## Open Questions

- [ ] CI provider (GitHub Actions assumed).
- [ ] Test framework standardized across packages (Vitest vs Jest).
