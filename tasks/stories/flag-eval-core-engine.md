---
title: eval-core evaluation engine (shared)
status: in-progress
owner: hapham
date: 2026-07-30
parent: tasks/epics/flag-authoring.md
size: L
---

# eval-core evaluation engine (shared)

## Story

As a developer, I want the pure evaluation engine in `packages/eval-core`, so that the web preview and the SDK compute identical flag results with no I/O.

## Acceptance Criteria

### AC1: Rule outcomes
- **Given** an ordered ruleset
- **When** `evaluate(ruleset, context, defaultValue)` runs
- **Then** a matching rule returns its variation (`RULE_MATCH`), no match returns the flag default (`DEFAULT`), and a disabled flag returns the default (`FLAG_OFF`).

### AC2: Sticky rollout
- **Given** a percentage rollout
- **When** the same context is evaluated as the percentage increases
- **Then** bucketing is deterministic and sticky (hash of `flagKey` + `bucketBy` value, default `bucketBy = key`); a context missing the `bucketBy` key is excluded and served the default (`MISSING_KEY`).

### AC3: Operators & purity
- **Given** conditions using `equals`/`not-equals`/`in`/`not-in`
- **When** they are evaluated
- **Then** they resolve correctly; the engine performs no I/O.

## Detailed Acceptance Criteria

(Added by BA — edge cases and detailed scenarios)

### AC4: Canonical 4-arg signature
- **Given** the `eval-core` package
- **When** a consumer calls the engine
- **Then** the exported signature is exactly `evaluate(ruleset: Ruleset | undefined, flagKey: string, context: EvaluationContext, defaultValue: Variation): EvaluationResult` (4 args), matching the approved design doc [ev:141-146] and superseding the abbreviated 3-arg wording in PM AC1.

### AC5: Reason precedence order
- **Given** a single `evaluate()` call
- **When** the algorithm resolves the result
- **Then** it applies this precedence, first match wins: `ruleset` undefined ⇒ `SDK_NOT_READY`; else flag missing or archived ⇒ `FLAG_NOT_FOUND`; else `enabled === false` ⇒ `FLAG_OFF`; else the ordered rule scan (`RULE_MATCH` / `ROLLOUT`); else `DEFAULT`. [ev:148-159]

### AC6: Missing attribute is false for every operator
- **Given** a condition on attribute `country` using any operator (`equals`, `not-equals`, `in`, `not-in`)
- **When** the evaluated context has no `country` attribute
- **Then** the condition is **false** for every operator — including the negative ones, so `country not-in ["US"]` does **not** fire for a context lacking `country`. [ev:161-166]

### AC7: Empty conditions always match
- **Given** a rule whose `conditions` array is empty
- **When** that rule is reached in the scan
- **Then** the rule matches unconditionally (its `result` is applied). [ev:153-154]

### AC8: Rollout skip surfaces MISSING_KEY
- **Given** a `rollout` rule whose `bucketBy` attribute is absent from the context
- **When** the rule is evaluated and no other rule matches afterward
- **Then** the rollout rule is **skipped** (excluded, not matched), and the final result is the flag `defaultVariation` with reason `MISSING_KEY`. [ev:156-168]

### AC9: Deterministic sticky bucketing formula
- **Given** a `rollout` rule with `percentage` and a resolved `bucketByValue`
- **When** the bucket is computed
- **Then** `bucket = int(first 8 hex chars of sha256(`${flagKey}:${bucketByValue}`)) / 0x100000000 * 100`, yielding a stable float in `[0, 100)`, and the user is **in** the rollout iff `bucket < percentage`. [ev:173-177]

### AC10: Stickiness across percentage increase
- **Given** a user whose computed bucket is 15
- **When** the rollout percentage is raised from 20 to 30
- **Then** the user remains in the rollout at both values (percentage is not part of the hash; raising 20→30 only *adds* buckets `[20,30)`, never re-shuffles existing members). [ev:180-182]

### AC11: Cohort bucketing via bucketBy
- **Given** a rollout with `bucketBy: "orgId"`
- **When** many users sharing one `orgId` are evaluated
- **Then** they all share a single bucket value and flip together as a whole org. [ev:183]

### AC12: Percentage boundaries
- **Given** a rollout rule
- **When** `percentage` is `0`
- **Then** no context is in (`bucket < 0` is never true); and when `percentage` is `100` every context is in (`bucket < 100` always true). [ev:81,173-177]

### AC13: Purity — identical input, identical output
- **Given** any fixed `(ruleset, flagKey, context, defaultValue)`
- **When** `evaluate()` is called repeatedly
- **Then** it returns the identical `EvaluationResult` every time, performing no I/O, no clock read, and no randomness. [ev:25,137]

### AC14: TYPE_MISMATCH never originates in core
- **Given** the boolean-only MVP
- **When** `eval-core.evaluate()` runs
- **Then** it never returns reason `TYPE_MISMATCH`; that reason is produced only by the typed wrapper (`evaluateBool`/etc.), never by the core. [ev:101-103]

## Notes

**Fills an ownership gap** — flag-authoring, ruleset-delivery, and sdk epics all disclaim building the engine; this plan homes it here (first consumer via preview). The SDK's `evaluate` and the server preview both import this exact module. Depends on `ruleset-shape-version-model`.

## Open Questions

