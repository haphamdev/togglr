---
title: Shared packages skeletons (shared-types + eval-core)
status: approved
owner: hapham
date: 2026-07-30
parent: tasks/epics/platform-foundation.md
size: S
---

# Shared packages skeletons (shared-types + eval-core)

## Story

As a developer, I want skeleton `shared-types` and `eval-core` packages, so that other packages can import the shared contracts and engine before they are filled in.

## Acceptance Criteria

### AC1: shared-types importable
- **Given** `packages/shared-types`
- **When** api/web/sdk import it
- **Then** stub contracts (`Ruleset`, `FlagConfig`, `Rule`, `Condition`, `RuleResult`, `EvaluationContext`, `EvaluationResult`, version types) resolve.

### AC2: eval-core pure stub
- **Given** `packages/eval-core`
- **When** it builds
- **Then** it exports a pure `evaluate(ruleset, context, defaultValue)` stub with no NestJS/DB/network deps.

## Detailed Acceptance Criteria

(Added by BA — edge cases and detailed scenarios)

### AC3: Canonical eval-core stub signature
- **Given** `packages/eval-core`
- **When** it is imported
- **Then** it exports `evaluate(ruleset | undefined, flagKey, context, defaultValue): EvaluationResult` — the 4-arg canonical form matching the engine design, so the real implementation is a drop-in replacement (supersedes the abbreviated 3-arg wording in AC2). [ev:141-146]

### AC4: Purity boundary of eval-core
- **Given** `packages/eval-core/package.json`
- **When** its dependencies are inspected
- **Then** it declares no NestJS, database, or network dependencies and is an import-graph leaf (depended on by api/sdk/web, depending only on `shared-types`). [arch:84,99-102]

### AC5: Types-only shared-types import
- **Given** `packages/shared-types`
- **When** api/web/sdk import it
- **Then** it is consumable for types with no runtime side effects (importing it executes no module-level code).

## Notes

Real shapes filled by Ruleset Delivery (`ruleset-shape-version-model`); real algorithm by Flag Authoring (`flag-eval-core-engine`). Depends on `foundation-scaffold-monorepo`.

## Open Questions

