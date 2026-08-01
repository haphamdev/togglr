---
title: Ruleset assembler service (env -> Ruleset snapshot)
status: draft
owner: hapham
date: 2026-08-01
parent: stories/ruleset-fetch-endpoint.md
sequence: 1
---

# Ruleset assembler service (env -> Ruleset snapshot)

## What

Add a service that assembles the `shared-types` `Ruleset` for a single environment: read the env's
non-archived flags joined to their `flag_env_configs`, map each row to a `FlagConfig`, and read the
env's current `ruleset_version`. Suggested `apps/api/src/sdk/ruleset.service.ts` (new `sdk/` area).

## Why

Fulfils ruleset-fetch AC1 (returns the environment `Ruleset` with its version) and AC5 (env-scoped,
RLS-isolated read). Produces exactly what the fetch controller serves and the SDK consumes.

## How

- `@Injectable()`; read via `this.tenant.trx` (RLS-scoped). The env id comes from the SDK key
  (`req.sdkEnvironmentId`, set by `SdkKeyGuard`) — accept it as a parameter,
  `assemble(environmentId): Promise<Ruleset>`.
- Query `environments` (for `id`, `ruleset_version`) + `flags` (exclude `archived_at IS NOT NULL`) +
  `flag_env_configs` (enabled, default_variation, rules) for that environment.
- Map to `Ruleset { environmentId, version: Number(ruleset_version), schemaVersion: 1,
  flags: FlagConfig[] }`; each `FlagConfig { key, type: "boolean", enabled, defaultVariation, rules }`.
- `guarded()` wrapper -> DIZZY_OWL on datastore failure (feeds AC8), mirroring `flag-config.service.ts`.

## Verification

- Unit test for the row -> FlagConfig mapping (pure): a config row maps to the right FlagConfig; an
  archived flag is excluded; `default_variation`/`rules` jsonb map to `Variation`/`Rule[]`. Extract the
  mapping as a pure function so it is unit-testable without a DB.
- `pnpm --filter @togglr/api typecheck && pnpm --filter @togglr/api test` green.

## Notes

- shared-types `Ruleset`/`FlagConfig`: `packages/shared-types/src/index.ts:15-29`.
- The deterministic/serializable + cache-key hardening of this output is a SEPARATE story
  (`ruleset-cache-ready-representation`) that refines THIS module — keep the assembler the single
  source so there is no second representation.
- Kysely types: `EnvironmentsTable.ruleset_version`, `FlagsTable`, `FlagEnvConfigsTable` in
  `apps/api/src/db/database.ts`.
