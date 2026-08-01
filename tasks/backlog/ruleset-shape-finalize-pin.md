---
title: Finalize and pin the served ruleset shape
status: draft
owner: hapham
date: 2026-07-31
parent: tasks/stories/ruleset-shape-version-model.md
sequence: 1
---

# Finalize and pin the served ruleset shape

## What

Promote the Foundation *stub* wire contract in `packages/shared-types/src/index.ts`
to the finalized, pinned ruleset shape and lock it against drift with type-level
tests. The stub already declares the full shape matching the design doc; this task
verifies it exactly matches the contract, that `eval-core` consumes it unchanged,
and adds regression tests that fail if any field, string-literal union, or the
8-value reason enum drifts.

Concretely, add type-level assertions covering:

- `Ruleset{environmentId, version, schemaVersion, flags[]}` — exact fields.
- `FlagConfig{key, type:'boolean', enabled, defaultVariation, rules[]}`.
- `Rule{conditions[], result}`; `Condition{attribute, operator, values}` with the
  operator union `'equals'|'not-equals'|'in'|'not-in'`.
- `RuleResult` discriminated union: exhaustive `switch` on `kind`
  (`'variation'|'rollout'`) is exhaustive (a `never` fallthrough assertion).
- `EvaluationResult.reason` is exactly the 8-value union
  `RULE_MATCH|ROLLOUT|DEFAULT|FLAG_OFF|FLAG_NOT_FOUND|SDK_NOT_READY|MISSING_KEY|TYPE_MISMATCH`
  (exhaustive assertion — adding/removing a member breaks the test).
- **AC6 widening proof:** a commented type-level check demonstrating a future
  `Variation = boolean | string` and an added `RuleResult` member extend the unions
  additively — existing consumers still typecheck (assignability, not a value test).
- **AC5 contract enablement:** assert `schemaVersion: number` exists on `Ruleset`
  and `'SDK_NOT_READY'` is a valid `reason` — the fields degrade-not-crash depends
  on. (The *runtime* degrade behavior is owned by the SDK epic, not this package.)

## Why

Fulfills story ACs **AC1** (shape exported and consumed unchanged by `eval-core`),
**AC3** (pinned type shapes match the design contract exactly), **AC6** (unions
admit multivariate additively), and the contract-level slice of **AC5**
(`schemaVersion` + `SDK_NOT_READY` present). Getting the shape wrong forces re-cuts
across every downstream epic (SDK, Real-Time, Telemetry, Audit), so it must be
locked.

## How

- Source of truth: `docs/design/ruleset-evaluation-sdk.md:50-95` (the "Ruleset
  Contract" block). Diff the current `packages/shared-types/src/index.ts` against it
  field-by-field; correct any drift (expected: none — stub already matches).
- Keep the package a **types-only, inert leaf**: no `class`/`enum`/`const`/runtime
  code, no workspace deps. The existing inert-module test in `index.test.ts` must
  still pass.
- Add the type-level tests to `packages/shared-types/src/index.test.ts` following the
  existing vitest pattern. Use compile-time assertions (e.g. `expectTypeOf` /
  `satisfies` / a local `AssertEqual<T,U>` helper + `never`-exhaustiveness) so a
  shape change fails `tsc`, not just runtime.
- Verify `eval-core` still consumes it unchanged: `packages/eval-core/src/index.ts`
  already imports `Ruleset`/`EvaluationContext`/`EvaluationResult`/`Variation`; no
  edits there — the typecheck passing is the proof.

## Verification

- `pnpm --filter @togglr/shared-types test` (or repo test) — inert-module test +
  new type-level tests pass.
- `pnpm --filter @togglr/shared-types exec tsc --noEmit` and
  `pnpm --filter @togglr/eval-core exec tsc --noEmit` both pass — proves the shape
  is consumed unchanged by `eval-core`.
- Deliberately breaking one field / removing one `reason` member locally makes the
  typecheck/test fail (drift guard works), then revert.

## Notes

- The served `FlagConfig` intentionally excludes `configVersion` — the SDK hot path
  does not need it. The per-flag concurrency counter is a separate authoring
  concern handled in task 2 (`ruleset-config-version-model`).
- SDK/preview "consumed unchanged" (rest of AC1) can only be fully exercised once
  those consumers exist (`local-evaluation-sdk` epic and the preview endpoint);
  `eval-core` is the available consumer now.
