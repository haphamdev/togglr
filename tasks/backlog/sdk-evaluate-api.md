---
title: evaluate() / evaluateBool() over eval-core (never throws)
status: draft
owner: hapham
date: 2026-08-01
parent: stories/sdk-evaluate-api.md
sequence: 1
---

# evaluate() / evaluateBool() over eval-core (never throws)

## What

The public evaluation surface on `Togglr`: `evaluate(flagKey, context, defaultValue)` and the typed
convenience `evaluateBool(flagKey, context, default)`, both delegating to `@togglr/eval-core`'s pure
`evaluate` with the SDK's cached ruleset supplied internally. Neither ever throws into the host.

## Why

Fulfils **sdk-evaluate-api** AC1 (correct default/rule-match/rollout results via eval-core), AC2 (safe
fallback for unknown flag / not-ready / missing key), AC3 (public signatures delegating to the 4-arg
`eval-core.evaluate(ruleset | undefined, flagKey, context, defaultValue)`), AC4 (never throws — any
internal error returns the caller default), AC5 (fallback reason matrix), AC6 (`evaluateBool` →
`TYPE_MISMATCH` on a non-boolean variation), AC7 (no `evaluateString`/`evaluateJson` in Phase 1).

## How

- `evaluate` passes `cache.get()` (a `Ruleset | undefined`) straight into `eval-core.evaluate`. When the
  SDK is not ready the cache is `undefined`, so eval-core returns `{ value: defaultValue, reason:
  "SDK_NOT_READY" }` — the reason matrix falls out of eval-core for free (AC5):
  not-ready → `SDK_NOT_READY`; unknown **or archived** flag → `FLAG_NOT_FOUND` (archived flags are
  already absent from the assembled ruleset); disabled → `FLAG_OFF`; rollout with an absent `bucketBy`
  value → `MISSING_KEY`.
- Never-throws (AC4): wrap the delegation in `try/catch`; on any unexpected error return
  `{ value: defaultValue, reason: <passthrough or SDK_NOT_READY> }` and route the error to the silent
  `logger` (no throw, no stdout).
- `evaluateBool` (AC6): call `evaluate`, then if the returned `value` is not a boolean, return the
  caller default with `reason: "TYPE_MISMATCH"`. This path is **produced only by the wrapper** (never by
  eval-core) and stays dormant in the boolean-only MVP.
- Do **not** add `evaluateString`/`evaluateJson` (AC7 — they arrive with multivariate in Phase 2).
- Decide the public return shape: expose `EvaluationResult` (`{ value, reason }`) so callers can read
  `reason`; keep `defaultValue` typed as `Variation`.

## Verification

- Unit (construct a `Togglr` with a stubbed cache / ruleset — no network): a matching variation rule →
  `{ value: true, reason: "RULE_MATCH" }`; disabled flag → `FLAG_OFF`; rollout hit → `ROLLOUT`; no match
  → `DEFAULT`; unknown flag → default + `FLAG_NOT_FOUND`; not-ready (empty cache) → default +
  `SDK_NOT_READY`; rollout with missing `bucketBy` → default + `MISSING_KEY` (AC1/AC2/AC5).
- Unit: a thrown error inside the delegation is caught and returns the caller default (AC4);
  `evaluateBool` on a non-boolean variation returns default + `TYPE_MISMATCH` (AC6).
- `pnpm --filter @togglr/sdk typecheck && pnpm --filter @togglr/sdk test` green.

## Notes

- Depends on `sdk-bootstrap-lifecycle` (ready-state + cache) and `flag-eval-core-engine` (shipped).
- eval-core signature + reason semantics: `packages/eval-core/src/index.ts:38-71`.
- SDK/API parity is structural — the API preview calls the identical `eval-core.evaluate`.
