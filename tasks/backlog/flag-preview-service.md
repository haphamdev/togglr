---
title: FlagPreviewService (evaluate draft/saved config via eval-core)
status: draft
owner: hapham
date: 2026-08-01
parent: stories/flag-preview.md
sequence: 1
---

# FlagPreviewService (evaluate draft/saved config via eval-core)

## What

Add `apps/api/src/flags/flag-preview.service.ts` — a `@Injectable() FlagPreviewService` with a
`preview(projectKey, flagKey, envKey, input)` method that returns the `EvaluationResult`
`{ value, reason }` computed by the shared engine `@togglr/eval-core`.

Input: `{ context: EvaluationContext; defaultValue: Variation; config?: { enabled; defaultVariation; rules } }`.

- **Draft path** (`config` present): validate its rules with the existing `assertValidRules`
  (CURIOUS_CAT on malformed rules) and evaluate the supplied draft.
- **Saved path** (`config` omitted): read the saved `flag_env_configs` row for (project, flag, env)
  on the tenant tx; unknown project/flag/env -> `LOST_OWL`; an archived flag (excluded from the
  assembled ruleset) yields `reason: FLAG_NOT_FOUND`.

## Why

Fulfils flag-preview AC1 (draft preview), AC2 (saved preview + archived -> FLAG_NOT_FOUND),
AC3 (invalid draft -> CURIOUS_CAT), AC4 (reason in resolvable subset), AC5 (SDK parity via the shared
eval-core), AC8 (context supplied in the request body).

## How

- Mirror `FlagConfigService`: `guarded()` wrapper -> DIZZY_OWL; queries on `this.tenant.trx`; reuse the
  key-resolution join from `flag-config.service.ts` `resolveConfig()`.
- eval-core exposes `evaluate(ruleset: Ruleset | undefined, flagKey, context, defaultValue): EvaluationResult`
  (`packages/eval-core/src/index.ts`) — it takes a whole `Ruleset` and finds the flag by key. Build a
  single-flag `Ruleset` `{ environmentId, version: 0, schemaVersion: 1, flags: [{ key: flagKey,
  type: "boolean", enabled, defaultVariation, rules }] }` and call
  `evaluate(ruleset, flagKey, input.context, input.defaultValue)`.
- Row -> FlagConfig mapping is direct (`enabled`; `default_variation` -> `defaultVariation` as
  `Variation`; `rules` as `Rule[]`) — reuse the read shape from `flag-config.service.ts` `get()`.
- Archived flag -> FLAG_NOT_FOUND: omit archived flags from the assembled ruleset so `evaluate`
  returns FLAG_NOT_FOUND for the absent key. Confirm eval-core's missing-key behavior.
- `api` already depends on `@togglr/eval-core` (`workspace:*`); dep-graph eval-core -> api is allowed.

## Verification

- `apps/api/src/flags/flag-preview.service.test.ts` (unit): eval-core is pure, so exercise the draft
  path with no DB — a matching variation rule -> `{value:true, reason:"RULE_MATCH"}`; flag off ->
  `FLAG_OFF`; rollout -> `ROLLOUT`; no matching rule + default -> `DEFAULT`; assert `reason` is never
  SDK-only (`SDK_NOT_READY`/`TYPE_MISMATCH`). Assert an `assertValidRules` failure surfaces as
  `CURIOUS_CAT` (DomainException, 400).
- `pnpm --filter @togglr/api typecheck && pnpm --filter @togglr/api test` green.

## Notes

- eval-core `evaluate` signature + `EvaluationReason`/`EvaluationResult`: `packages/shared-types/src/index.ts:48-63`.
- SDK parity (AC5) is structural — identical eval-core call as the SDK; the unit test documents it.
- The saved-path key resolution and archived filter mirror `flag-config.service.ts`.
