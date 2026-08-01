---
title: FlagsService (create, list, get, archive)
status: draft
owner: hapham
date: 2026-08-01
parent: stories/flag-crud.md
sequence: 3
---

# FlagsService (create, list, get, archive)

## What

Implement `apps/api/src/flags/flags.service.ts` — the tenant-scoped data layer for flag
create, list, get, and metadata patch (description + archive), plus its unit tests.
Config *editing* is out of scope (that is `flag-config-edit`).

## Why

Fulfills AC1 (create + seed), AC2 (`GRUMPY_CAT`/`FAT_CAT`), AC3 (list & archive), AC4
(seed every env), AC5 (type immutable), AC6 (archive semantics), AC7 (`LOST_OWL`), AC13
(`DIZZY_OWL`). Depends on tasks 1 (tables) and 2 (DTOs).

## How

Mirror `apps/api/src/org/projects.service.ts` + `environments.service.ts` exactly:
`@Injectable`, inject `TenantContextService`, run all queries on `this.tenant.trx` with
`this.tenant.orgId`, wrap every method in a `guarded()` that maps non-`DomainException`
errors to `DIZZY_OWL` 503 (AC13). Reuse the `isUniqueViolation`/`toIso` helpers.

- `create({ projectKey, key, description?, type? })`:
  - Resolve `project_id` by key within the tx (unknown project → `LOST_OWL` 404), like
    `EnvironmentsService.projectId`.
  - **Key pattern check in the service**, NOT Zod: if `!/^[a-z0-9-]+$/.test(key)` throw
    `new DomainException("GRUMPY_CAT", 400, ...)` (AC2). The Zod schema in the controller only
    guarantees `key` is a non-empty string → `CLUMSY_OWL` for wrong-type/missing (AC12).
  - Default `type` to `"boolean"`; reject any non-`boolean` type with `CLUMSY_OWL` (AC5).
  - Insert the `flags` row; catch unique violation → `FAT_CAT` 409 (AC2).
  - Load the project's environments (all, including archived — every env gets a config row,
    AC4) and **seed a `flag_env_configs` row per environment**: `enabled:false,
    default_variation:false, rules:'[]', config_version:0` (AC1). Do it in one multi-row
    insert inside the same tx.
  - Return the created `Flag` plus its per-env summary (all seeded rows) as
    `FlagWithEnvironments`.
- `list({ projectKey, includeArchived })`:
  - Resolve project id; select flags for that project, excluding `archived_at IS NOT NULL`
    unless `includeArchived` (AC3/AC6). Order by `created_at`.
  - For each flag, join `flag_env_configs`→`environments` to build
    `FlagEnvConfigSummary[]` (`envKey`, `enabled`, `defaultVariation`, `ruleCount =
    jsonb_array_length(rules)`, `configVersion`). Prefer a single grouped query over N+1.
- `get({ projectKey, flagKey })`: same shape as one list element; unknown flag → `LOST_OWL`
  404 (AC7).
- `patch({ projectKey, flagKey, description?, archived? })`: update only `description` and
  `archived_at` (AC5 — `key`/`type` never mutable, and are simply absent from the update set).
  Archive toggle uses the `environments` pattern: `archived_at = archived ?
  sql`coalesce(archived_at, now())` : null` (AC6). Unknown flag → `LOST_OWL`. Return the
  updated `FlagWithEnvironments`.

## Verification

- `apps/api/src/flags/flags.service.test.ts` — unit tests (mock/stub the tenant tx, or use
  the lightweight in-suite pattern the repo uses for services) covering: bad key →
  `GRUMPY_CAT`; non-boolean type → `CLUMSY_OWL`; duplicate → `FAT_CAT`; archive sets/clears
  `archived_at`; unknown flag/project → `LOST_OWL`. If mocking the tx proves heavy, fold
  these into the task-4 integration suite and keep the unit file for the pure branches
  (key regex, type check) — note the choice in the PR.
- `pnpm --filter @togglr/api typecheck` green.

## Notes

`config_version` starts at 0 (AC1); flag-config-edit bumps it. Seeding reads **all**
environments (archived included) so a later-unarchived env already has a config row —
consistent with the story's open question leaning (backfill on create). Archived-flag SDK
behavior (`FLAG_NOT_FOUND`) is realized by the ruleset-fetch endpoint excluding archived
flags, not here.
