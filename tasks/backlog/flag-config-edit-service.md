---
title: FlagConfigService (get + optimistic-concurrency PATCH tri-write)
status: done
owner: hapham
date: 2026-08-01
parent: stories/flag-config-edit.md
sequence: 2
---

# FlagConfigService (get + optimistic-concurrency PATCH tri-write)

## What

Add `FlagConfigService` (new file under `apps/api/src/flags/`) exposing `get` and `patch` for
a single `(flag, environment)` config, plus a pure exported `assertValidRules` validator. The
`patch` performs the atomic tri-write: config row (`config_version + 1`, guarded by
`expectedConfigVersion`), environment `ruleset_version + 1`, and an `audit_logs` insert — all
on the request tenant transaction. Add `AuditLogsTable` typing to the Kysely `Database`
(the table already exists from the baseline migration; only the TS type is missing).

## Why

The write core of the story. Covers AC1 (toggle + bump + audit in one tx), AC2/AC8 (rules
replace wholesale; fields patch independently), AC3/AC5 (stale version → `JEALOUS_CAT` via
0-rows-affected), AC6 (atomic rollback), AC7 (rule validation → `CURIOUS_CAT`), AC9 (versions
returned), AC14 (unknown flag/env → `LOST_OWL`), AC15 (`DIZZY_OWL` via `guarded()`).

## How

Mirror `flags.service.ts` structure (guarded wrapper, tenant-tx queries, LOST_OWL resolvers):

- **DB typing** — add `AuditLogsTable` to `apps/api/src/db/database.ts` and register it in
  `Database`. Columns per baseline migration (`1730000000000_baseline.js:52-64`):
  `id: Generated<string>`, `organization_id: string`, `actor_user_id: string | null`,
  `action: string`, `target_type: string | null`, `target_id: string | null`,
  `environment_id: string | null`, `before: unknown | null`, `after: unknown | null`,
  `created_at: Generated<Date>`. (append-only: no UPDATE/DELETE grant — service only INSERTs.)
- **Resolver** — `resolveIds(trx, projectKey, flagKey, envKey)` returns
  `{ flagId, environmentId, configId }` by joining `projects`→`flags`→`environments`→
  `flag_env_configs` (all RLS-scoped); any missing hop → `throw DomainException("LOST_OWL",
  404, …)` (AC14). Reuse the `resolveProjectId` pattern from `flags.service.ts:46-54`.
- **`assertValidRules(rules: Rule[]): void`** (exported, pure, unit-tested — mirrors
  `assertValidFlagKey`): for each rule, each condition: `operator ∈ {equals,not-equals,in,
  not-in}`, `values` non-empty; `result.kind ∈ {variation,rollout}`; for `rollout`,
  `percentage` an integer in `0..100` (0 and 100 valid), `bucketBy` a non-empty string. Any
  violation → `throw new DomainException("CURIOUS_CAT", 400, <reason>)` (AC7). Keep it a plain
  structural check — do NOT pull in `eval-core` (that package evaluates, it does not validate).
- **`get(projectKey, flagKey, envKey): Promise<FlagEnvConfigDetail>`** — resolve, select
  `enabled, default_variation, rules, config_version, updated_at`, map (`Number(config_version)`,
  `default_variation as Variation`, `rules as Rule[]`, `toIso(updated_at)`).
- **`patch(projectKey, flagKey, envKey, body: FlagEnvConfigUpdate): Promise<FlagEnvConfigUpdated>`**,
  all inside `guarded()`:
  1. If `body.rules !== undefined` → `assertValidRules(body.rules)` first (fail before any write).
  2. Resolve ids (LOST_OWL on miss).
  3. Build the SET (only present fields; AC8). `rules`/`defaultVariation` are jsonb — write with
     `sql`\`${JSON.stringify(v)}::jsonb\` (or Kysely's `jsonb` helper); never pass a raw JS
     object/boolean to a jsonb column. Always include `config_version = config_version + 1`
     and `updated_at = now()`.
  4. Guarded update: `UPDATE flag_env_configs SET … WHERE id = $configId AND config_version =
     $expectedConfigVersion RETURNING config_version, enabled, default_variation, rules,
     updated_at`. If `executeTakeFirst()` returns `undefined` (0 rows) → `throw
     DomainException("JEALOUS_CAT", 409, "Config version conflict; refetch and retry")` (AC5).
  5. Bump env: `UPDATE environments SET ruleset_version = ruleset_version + 1 WHERE id =
     $environmentId RETURNING ruleset_version` (AC1).
  6. Insert audit: `INSERT INTO audit_logs (organization_id, actor_user_id, action,
     target_type, target_id, environment_id, before, after)` with `action:'flag_config.update'`,
     `target_type:'flag'`, `target_id: flagId`, before/after JSON snapshots. `actor_user_id`
     comes from the tenant context — see Notes.
  7. Return `FlagEnvConfigUpdated` (new `configVersion`, bumped `rulesetVersion`, echoed fields).
  Steps 4-6 run on the same `trx` (opened by `TransactionInterceptor`), so a throw at any step
  rolls back all three — no partial state (AC6).
- **Unit test** `flag-config.service.test.ts` (direct import, no DI; mirror
  `flags.service.test.ts`): `assertValidRules` accepts valid rules incl. `percentage:0` and
  `percentage:100`; rejects `percentage:-1`/`101`, bad operator, empty `values[]`, unknown
  `kind` — each a `DomainException` with `.code==="CURIOUS_CAT"`, `.status===400`.

## Verification

- `pnpm --filter @togglr/api typecheck` green with the augmented `Database`.
- `pnpm --filter @togglr/api test` — `flag-config.service.test.ts` green; existing unit suite green.
- (Full AC1/AC6 atomicity + JEALOUS_CAT proof lands in the seq-3 integration test.)

## Notes

- **Actor id:** `TenantContextService` exposes `orgId`/`role`/`trx` but not the user id.
  Confirm how the actor reaches the service — either extend the tenant store with `userId`
  (set by `TransactionInterceptor` from `req.session.userId`) or pass it from the controller.
  Prefer threading it through the tenant store so the audit insert stays inside the service.
  This is the one cross-cutting decision in the story; settle it here.
- **jsonb encoding:** unlike flag-crud create (which relied on column defaults), this task
  writes `rules`/`default_variation` explicitly → must JSON-encode + `::jsonb` cast.
- `config_version` / `ruleset_version` are `int`/`bigint` → may arrive as string; coerce with
  `Number(...)` on the way out.
