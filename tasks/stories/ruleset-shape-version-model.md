---
title: Ruleset shape & version model (shared-types)
status: done
owner: hapham
date: 2026-07-30
parent: tasks/epics/ruleset-delivery-contract.md
size: M
---

# Ruleset shape & version model (shared-types)

## Story

As a developer, I want the canonical ruleset shape and version model in `shared-types`, so that the SDK, engine, and preview all speak one contract.

## Acceptance Criteria

### AC1: Shape
- **Given** `packages/shared-types`
- **When** it is consumed
- **Then** it exports the finalized `Ruleset` (`environmentId`, `version`, `schemaVersion`, `flags[]` with `key/type/enabled/defaultVariation/rules`) used unchanged by `eval-core`, SDK, and preview.

### AC2: Two versions
- **Given** the model
- **When** the versions are inspected
- **Then** the per-environment ruleset `version` is a monotonic integer and the per-flag `configVersion` is independent (drives optimistic concurrency).

## Detailed Acceptance Criteria

(Added by BA — edge cases and detailed scenarios)

### AC3: Pinned type shapes
- **Given** `packages/shared-types`
- **When** the exported types are inspected
- **Then** they match the design contract exactly: `Ruleset{environmentId:string, version:number, schemaVersion:number, flags:FlagConfig[]}`; `FlagConfig{key:string, type:'boolean', enabled:boolean, defaultVariation:Variation, rules:Rule[]}`; `Rule{conditions:Condition[], result:RuleResult}`; `Condition{attribute:string, operator:'equals'|'not-equals'|'in'|'not-in', values:(string|number|boolean)[]}`; `RuleResult = {kind:'variation', variation} | {kind:'rollout', percentage /*0..100*/, bucketBy, variation}`; `Variation = boolean` (MVP); `EvaluationContext{key?, [attr]: string|number|boolean|undefined}`; `EvaluationResult{value:Variation, reason}` where `reason` is the 8-value enum `RULE_MATCH|ROLLOUT|DEFAULT|FLAG_OFF|FLAG_NOT_FOUND|SDK_NOT_READY|MISSING_KEY|TYPE_MISMATCH`. [ev:50-95]

### AC4: Two independent version counters
- **Given** the model
- **When** the two "version" concepts are inspected
- **Then** the per-environment ruleset `version` is a monotonic **integer** counter bumped on any change in the env, and the per-(flag,environment) `configVersion` is an independent counter that drives optimistic-concurrency `409`s; the two are never conflated. [arch:120-134; ev:111]

### AC5: schemaVersion forward-compatibility (degrade, not crash)
- **Given** `schemaVersion` starts at `1`
- **When** an older SDK receives a payload with a newer `schemaVersion` it cannot fully parse
- **Then** if it already holds a last-known ruleset it serves that (holds last-known) rather than crashing, and on **first** bootstrap with no last-known it stays not-ready and `evaluate()` returns caller defaults with reason `SDK_NOT_READY` until a compatible payload arrives. [ev:97-107]

### AC6: Unions admit multivariate without a breaking change
- **Given** `Variation` and `RuleResult` are declared as unions
- **When** multivariate (`string`/`JsonValue`) variations are added later
- **Then** they extend the existing unions additively — no consumer of `eval-core`, SDK, or preview requires a breaking change. [ev:46-48]

## Notes

Fills the `shared-types` skeleton from Foundation; flag config edits bump the env ruleset version defined here. Depends on `foundation-shared-packages-skeletons`.

## Open Questions

- [x] Ruleset version type (contract uses integer) → **integer** per-environment monotonic counter. ([arch:120-134])
- [x] schemaVersion forward-compat strategy → **degrade-not-crash**: hold last-known on an unparseable newer payload, or stay not-ready (`SDK_NOT_READY`) on first bootstrap. ([ev:97-107])
