---
title: Pure evaluate engine (precedence, operators, rollout)
status: done
owner: hapham
date: 2026-07-31
parent: stories/flag-eval-core-engine.md
sequence: 2
---

# Pure evaluate engine (precedence, operators, rollout)

## What

Replace the Foundation stub `evaluate` in `packages/eval-core/src/index.ts` with the
real first-match-wins engine: precedence/reasons, condition operators (membership),
variation rules, and percentage rollout wired to `bucket` from task 1.

## Why

Fulfills AC1, AC3, AC4, AC5, AC6, AC7, AC8, AC10, AC11, AC12, AC13, AC14 (and AC2 with
task 1). See the plan's algorithm block for the exact control flow and value sources.

## How

- Signature unchanged from the stub / design [ev:141-146]:
  `evaluate(ruleset: Ruleset | undefined, flagKey: string, context: EvaluationContext,
  defaultValue: Variation): EvaluationResult`.
- Precedence: `SDK_NOT_READY` → `FLAG_NOT_FOUND` (flag absent from `flags[]`; no archived
  field) → `FLAG_OFF` → ordered rule scan → `MISSING_KEY`/`DEFAULT`. Use the exact code in
  the plan's "Engine code" block.
- Operators = membership; missing attribute false for all four.
- Rollout: `bucketBy` defaults to `"key"`; absent `bucketBy` value ⇒ skip + remember, so a
  no-match fallthrough surfaces `MISSING_KEY`; else `bucket(flagKey, value) < percentage`
  ⇒ `ROLLOUT`.
- Replace the stub's two behavioral tests (they assert stub-only `DEFAULT` for a missing
  flag); keep the `SDK_NOT_READY` test and the whole dependency-boundary `describe` block.

## Verification

- Every AC scenario in the plan's Verification section passes (concrete input→output).
- `pnpm --filter @togglr/eval-core test` + `... typecheck` + `pnpm deps:check` green.

## Notes

eval-core does not validate rules (authoring's CURIOUS_CAT job) and never returns
`TYPE_MISMATCH` (boolean-only MVP; that reason is the SDK typed-wrapper's, AC14).
