---
title: Flag config DTOs in shared-types
status: done
owner: hapham
date: 2026-08-01
parent: stories/flag-config-edit.md
sequence: 1
---

# Flag config DTOs in shared-types

## What

Add the per-environment flag-config wire contracts to `@togglr/shared-types`: the GET
detail shape, the PATCH request shape, and the PATCH success shape (which additionally
carries the bumped `rulesetVersion`). Reuse the existing `Rule` / `Condition` / `RuleResult`
and `Variation` types — do **not** redefine the rule model.

## Why

Foundational typing for the whole story: the service returns these, the controller's Zod
mirrors the request shape, and the integration test asserts against them. Backs AC2 (rules
returned on read), AC8 (independent fields), and AC9 (versions on success). Matches the
contract in `docs/api/togglr-api.md:700-762`.

## How

- Append to `packages/shared-types/src/control-plane.ts` (types only; terse JSDoc like the
  neighbouring `Flag*` types). `Rule` and `Variation` live in the package root `src/index.ts`
  (`Rule` at index.ts:30, `Variation` at index.ts:8); `control-plane.ts` already imports
  `Variation` from `./index` — extend that import to also bring in `Rule`.
- Add:
  ```ts
  /** A flag's config in one environment, as returned by GET …/config. */
  export interface FlagEnvConfigDetail {
    enabled: boolean;
    defaultVariation: Variation;
    rules: Rule[];
    configVersion: number;
    updatedAt: string;
  }

  /** PATCH …/config body. `expectedConfigVersion` gates optimistic concurrency; a present
   *  `rules` replaces the ordered list wholesale. */
  export interface FlagEnvConfigUpdate {
    expectedConfigVersion: number;
    enabled?: boolean;
    defaultVariation?: Variation;
    rules?: Rule[];
  }

  /** PATCH …/config success shape — detail plus the bumped environment ruleset version. */
  export interface FlagEnvConfigUpdated extends FlagEnvConfigDetail {
    rulesetVersion: number;
  }
  ```

## Verification

- `pnpm --filter @togglr/shared-types typecheck` green.
- `pnpm deps:check` still green (types-only import back into `./index` introduces no runtime
  cycle — same pattern already used for `Variation`).

## Notes

Cross-task contract: the service (seq 2) and controller (seq 3) MUST use these exact names
and shapes. `rules: Rule[]` is the strong type consumers see; the controller accepts a
permissive array at the boundary and the service semantically validates it (→ `CURIOUS_CAT`),
so the wire type stays `Rule[]`.
