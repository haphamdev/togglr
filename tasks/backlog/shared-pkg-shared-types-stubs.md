---
title: Export shared-types stub contract types
status: done
owner: hapham
date: 2026-07-30
parent: tasks/stories/foundation-shared-packages-skeletons.md
sequence: 1
---

# Export shared-types stub contract types

## What

In `packages/shared-types`, export the stub wire-contract types that all other
packages (`api`, `web`, `sdk`, `eval-core`) import for the ruleset shape,
evaluation context/result, and version types. These are the placeholder shapes
that Ruleset Delivery (`ruleset-shape-version-model`) later fills in — for now
they must exist, be correctly named, be importable, and carry no runtime code.

Export at minimum:

- `Variation` (`= boolean` for the MVP)
- `Ruleset` (`{ environmentId, version: number, schemaVersion: number, flags: FlagConfig[] }`)
- `FlagConfig` (`{ key, type: 'boolean', enabled, defaultVariation, rules }`)
- `Rule` (`{ conditions: Condition[], result: RuleResult }`)
- `Condition` (`{ attribute, operator: 'equals'|'not-equals'|'in'|'not-in', values }`)
- `RuleResult` (`{ kind: 'variation'; variation } | { kind: 'rollout'; percentage; bucketBy; variation }`)
- `EvaluationContext` (`{ key?: string; [attr]: string|number|boolean|undefined }`)
- `EvaluationResult` (`{ value: Variation; reason: <8-value reason union> }`)
- Version types (the per-env monotonic `version: number` and `schemaVersion: number`
  are on `Ruleset`; expose any named version aliases the contract needs, e.g. a
  `RulesetVersion`/`SchemaVersion` type alias, so consumers can reference them).

## Why

Fulfills `foundation-shared-packages-skeletons` AC1 (api/web/sdk can import the
stub contracts `Ruleset`, `FlagConfig`, `Rule`, `Condition`, `RuleResult`,
`EvaluationContext`, `EvaluationResult`, version types and they resolve) and AC5
(the package is consumable for types with no runtime side effects — importing it
executes no module-level code).

## How

- Create/populate `packages/shared-types/src/index.ts` (barrel) with the type
  declarations above. Model shapes on the approved design doc
  `docs/design/ruleset-evaluation-sdk.md:50-95` (the "Ruleset Contract
  (`packages/shared-types`)" block) — copy the exact field names, string-literal
  unions, and the 8-value `EvaluationResult.reason` union
  (`RULE_MATCH | ROLLOUT | DEFAULT | FLAG_OFF | FLAG_NOT_FOUND | SDK_NOT_READY |
  MISSING_KEY | TYPE_MISMATCH`).
- Use only `interface` / `type` declarations and `export type`. No `class`, no
  `enum` (enums emit runtime code), no top-level `const`/`let`/function bodies, no
  side-effecting imports. This is what makes AC5 hold: the compiled output is
  effectively empty.
- Ensure `package.json` `name` is `@togglr/shared-types` (per the pnpm-workspace
  naming set in `foundation-scaffold-monorepo`) with `main`/`types` pointing at the
  build/`src` entry, TypeScript `strict`, and it is a workspace-resolvable
  dependency for `api`/`web`/`sdk`/`eval-core`.
- Keep it an import-graph leaf: `shared-types` depends on nothing in the workspace
  (`docs/design/architecture-overview.md:87-102`).

## Verification

- Add a compile-only consumer check: from another workspace package (e.g. a scratch
  `*.ts` in `apps/api` or `packages/eval-core`) `import type { Ruleset, FlagConfig,
  Rule, Condition, RuleResult, EvaluationContext, EvaluationResult } from
  '@togglr/shared-types'` and reference each — `pnpm --filter <consumer> exec tsc
  --noEmit` (or the repo typecheck) passes, proving AC1 resolution.
- Prove AC5 (no runtime side effects): build the package, then inspect the emitted
  JS entry — it must contain no executable statements (only `export {}` /
  type-erased output). Test to write: a unit test in `packages/shared-types` that
  `require('@togglr/shared-types')` (or `await import(...)`) returns an object with
  no own enumerable runtime members / triggers no logged side effect — i.e. the
  module is inert. Type-level assertions (e.g. `tsd`/`expectTypeOf`) may back the
  shape check.

## Notes

- Real shapes are filled by `ruleset-shape-version-model` (Ruleset Delivery); these
  are deliberately stubs that match the final shape so the swap is non-breaking.
- Depends on `foundation-scaffold-monorepo` (workspace + package scaffolding must
  exist first). Consumed by `shared-pkg-eval-core-stub` (task 2) and by api/web/sdk.
- Do NOT add any runtime dependency; `shared-types` must stay a leaf
  (`docs/design/architecture-overview.md:99-102`).
