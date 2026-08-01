---
title: Deterministic, cache-addressable ruleset representation
status: draft
owner: hapham
date: 2026-08-01
parent: stories/ruleset-cache-ready-representation.md
sequence: 1
---

# Deterministic, cache-addressable ruleset representation

## What

Harden the ruleset assembler's output into a stable, serializable representation and expose a
cache-addressing helper — no Redis wired. Refines the assembler introduced by
`ruleset-fetch-endpoint` (sequence 1); do NOT create a second representation.

## Why

Fulfils ruleset-cache-ready AC1/AC3 (deterministic bytes: stable field order, no timestamps),
AC2/AC4 (cache-addressable by `ruleset:<envId>`, version carried in the value), AC5 (full snapshot,
not a diff), AC6 (`schemaVersion` embedded alongside environmentId/version/flags), AC7 (representation
only, no Redis).

## How

- Guarantee deterministic ordering in the assembler: flags emitted in a stable order (e.g. by flag
  `key`), rules kept in their persisted (evaluation) order, conditions in stored order, object fields in
  a fixed order. The `Ruleset` type already carries `environmentId`, `version`, `schemaVersion`,
  `flags` and has NO timestamps — keep it that way.
- Add a canonical `serializeRuleset(ruleset): string` producing byte-identical output for a fixed
  (env, version), and `rulesetCacheKey(environmentId): string` -> `` `ruleset:${environmentId}` ``. The
  fetch endpoint's ETag/body should serve these canonical bytes so a future Redis cache fronts the same
  value without a re-cut.
- Full snapshot always — never a diff.

## Verification

- Unit test: assemble/serialize the same (env, version) twice -> byte-identical output; `flags` order is
  stable regardless of DB row order; the serialized value contains `schemaVersion`, `environmentId`,
  `version`, `flags`; `rulesetCacheKey("e1") === "ruleset:e1"`. No Redis import anywhere.
- `pnpm --filter @togglr/api typecheck && pnpm --filter @togglr/api test` green.

## Notes

- Depends on `ruleset-fetch-endpoint` (this refines its assembler and wires its ETag/body to the
  canonical bytes).
- The actual Redis cache is Phase 2 (Real-Time Propagation) — explicitly out of scope (AC7).
- Rationale refs: `[ev:53-58,119]` (schemaVersion + cache key), `[api:813-825]` (deterministic bytes).
