---
title: Micro-benchmark p99 evaluate < 5ms + bucketing golden vectors
status: draft
owner: hapham
date: 2026-08-01
parent: stories/sdk-benchmark-load-test.md
sequence: 1
---

# Micro-benchmark p99 evaluate < 5ms + bucketing golden vectors

## What

A pure, no-infra micro-benchmark that proves the headline latency claim as a Phase-1 gate, plus
deterministic/sticky-bucketing tests. Lives in the SDK (or `eval-core`) as a runnable script + a
committed result.

## Why

Fulfils **sdk-benchmark-load-test** AC1 (p99 in-process `evaluate` < 5 ms), AC2/AC6 (deterministic,
sticky bucketing — golden vectors + no flip-flop as rollout % rises), AC3 (committed micro-benchmark
scale), AC4 (pure `eval-core` micro-benchmark — no network/DB/server), AC5 (N-connection/throughput load
test explicitly deferred to Phase 2, which needs SSE to be measurable).

## How

- Build a representative ruleset: **50 flags × up to 10 rules each** (mixed variation + rollout rules,
  varied conditions), and **1,000,000 random evaluation contexts** (varied `key` + attributes).
- Run `eval-core.evaluate` (the same engine the SDK uses) across the contexts; measure per-call latency,
  compute p50/p99, and assert **p99 < 5 ms**. Warm up before measuring; run single-process, no I/O
  (AC3/AC4).
- Publish the result: a script under `packages/sdk/` (or `packages/eval-core/`) runnable via a
  `bench` script, and a committed results snapshot (e.g. `packages/sdk/BENCHMARKS.md`) with the numbers +
  machine/node version so the claim is auditable.
- Bucketing (AC2/AC6): a golden-vector test pinning specific `(flagKey, key) → bucket` values against
  `eval-core.bucket`, and a stickiness test asserting a user assigned at 10% stays assigned as the
  rollout rises 10 → 50 → 100 (buckets only added, never reshuffled).

## Verification

- `bench` script runs green and prints p50/p99 with p99 < 5 ms on a dev machine; the committed
  `BENCHMARKS.md` records the run (AC1/AC3).
- Unit: golden-vector bucket values are stable, and stickiness holds across 10/50/100 (AC2/AC6).
- `pnpm --filter @togglr/sdk typecheck && pnpm --filter @togglr/sdk test` green (bucketing tests); the
  benchmark itself is a script, not part of the unit gate (keep it out of the default `test` run so CI
  stays fast — invoke via `pnpm --filter @togglr/sdk bench`).

## Notes

- Depends on `sdk-evaluate-api` and `flag-eval-core-engine` (shipped; `bucket` + `evaluate` in
  `packages/eval-core/src/index.ts`).
- The full N-SDK / evals-per-second load test is a **Phase-2** concern (SSE fan-out) — do not attempt a
  connection-scale test here (AC5).
- Determinism: `bucket` is `sha256(flagKey:bucketByValue)` — no clock/randomness, so golden vectors are
  stable across machines.
