---
title: "Benchmark & load test: p99 evaluate < 5ms"
status: approved
owner: hapham
date: 2026-07-30
parent: tasks/epics/local-evaluation-sdk.md
size: M
---

# Benchmark & load test: p99 evaluate < 5ms

## Story

As a platform operator, I want a published benchmark proving p99 in-process evaluate < 5ms, so that the headline latency claim is demonstrated as a Phase-1 gate.

## Acceptance Criteria

### AC1: Latency gate
- **Given** a representative ruleset
- **When** the benchmark runs
- **Then** it reports p99 in-process `evaluate` latency < 5ms.

### AC2: Determinism
- **Given** rollout-percentage increases
- **When** bucketing is tested
- **Then** assignments are deterministic and sticky (no flip-flopping).

## Detailed Acceptance Criteria

(Added by BA — edge cases and detailed scenarios)

### AC3: Micro-benchmark scale
- **Given** a representative ruleset of 50 flags × up to 10 rules each
- **When** the micro-benchmark runs `evaluate()` across 1M random contexts
- **Then** it reports p99 in-process `evaluate()` latency < 5 ms, and the result is published in the repo. [ev:255-257]

### AC4: Pure-function gate, no infra
- **Given** the acceptance gate
- **When** the benchmark executes
- **Then** it is a pure-function `eval-core` micro-benchmark requiring no network, database, or server infrastructure. [arch:243-244]

### AC5: N-connection load test deferred to Phase 2
- **Given** Phase 1
- **When** the load-test scope is considered
- **Then** the multi-connection / throughput load test is deferred to Phase 2 (it needs SSE to be measurable); only the pure micro-benchmark gates Phase 1. [ev:257; arch:243-246]

### AC6: Deterministic golden vectors and stickiness
- **Given** fixed `(flagKey, key)` inputs
- **When** bucketing is computed
- **Then** a golden-vector test pins specific `(flagKey, key) → bucket` values, and a bucketed user stays assigned as the rollout percentage rises 10 → 50 → 100 (no flip-flopping). [ev:247-249]

## Notes

Depends on `sdk-evaluate-api`.

## Open Questions

- [x] Load-test target scale (N SDKs, M evals/sec) to commit to. → **Phase-1 gate is a pure micro-benchmark**: 50 flags × up to 10 rules over 1M random contexts, p99 `evaluate()` < 5 ms, published in the repo; the full N-SDK / throughput load test is **deferred to Phase 2** (needs SSE to be measurable). (ev:255-257; arch:243-246)
