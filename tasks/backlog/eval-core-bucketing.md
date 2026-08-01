---
title: Deterministic sticky bucketing primitive
status: draft
owner: hapham
date: 2026-07-31
parent: stories/flag-eval-core-engine.md
sequence: 1
---

# Deterministic sticky bucketing primitive

## What

Add a pure, exported `bucket(flagKey, bucketByValue)` to
`packages/eval-core/src/index.ts` that returns a stable float in `[0, 100)`:
`Number.parseInt(sha256(`${flagKey}:${bucketByValue}`) first 8 hex chars, 16) /
0x1_0000_0000 * 100`, using `node:crypto`. No change to `evaluate` yet.

## Why

Fulfills AC9 (bucketing formula) and underpins AC2/AC10/AC11 (sticky/cohort rollout).
Percentage is deliberately NOT part of the hash, which is what makes rollouts sticky.

## How

- `import { createHash } from "node:crypto";`
- Signature: `export function bucket(flagKey: string, bucketByValue: string | number |
  boolean): number`. Stringify via the template literal.
- Formula exactly: `(Number.parseInt(createHash("sha256").update(`${flagKey}:${bucketByValue}`)
  .digest("hex").slice(0, 8), 16) / 0x1_0000_0000) * 100`.
- Do NOT add a hashing dependency; `node:crypto` is a builtin.

## Verification (TDD, one behavior per red→green)

- Golden vectors (exact, externally computed — pin with `toBeCloseTo(_, 10)`):
  `bucket("new-checkout","user-123") ≈ 65.74595915153623`;
  `bucket("new-checkout","user-456") ≈ 17.59069284889847`;
  `bucket("beta","org-42") ≈ 5.843387800268829`.
- Range: for a spread of inputs, `0 <= bucket < 100`.
- Determinism: two calls with the same args are strictly equal.
- `pnpm --filter @togglr/eval-core test` and `... typecheck` green; existing stub
  `evaluate` tests and the dependency-boundary test still pass (evaluate untouched).

## Notes

Exported (not internal) so golden vectors pin exact values and SDK/preview reuse the
identical primitive.
