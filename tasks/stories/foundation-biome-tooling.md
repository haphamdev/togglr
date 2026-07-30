---
title: Biome as the single lint/format source of truth
status: approved
owner: hapham
date: 2026-07-30
parent: tasks/epics/platform-foundation.md
size: S
---

# Biome as the single lint/format source of truth

## Story

As a developer, I want Biome configured as the only linter/formatter, so that style and lint are consistent with no ESLint/Prettier drift.

## Acceptance Criteria

### AC1: Runs clean
- **Given** the scaffold
- **When** `pnpm biome check` runs
- **Then** it checks every package and passes.

### AC2: Catches violations
- **Given** a formatting/lint violation
- **When** `biome check` runs
- **Then** it fails (and blocks CI).

## Detailed Acceptance Criteria

(Added by BA — edge cases and detailed scenarios)

### AC3: Format and lint in one command
- **Given** the Biome configuration
- **When** `biome check` runs
- **Then** it performs both formatting and lint checks in one pass, and `biome format --write` autofixes formatting.

### AC4: Single config, no rival tools
- **Given** the repo
- **When** local and CI runs invoke Biome
- **Then** exactly one root `biome.json` governs both, and the repo contains no ESLint or Prettier config files.

## Notes

No ESLint/Prettier anywhere (AGENTS.md). Depends on `foundation-scaffold-monorepo`.

## Open Questions

