---
title: Model the per-flag configVersion counter (distinct from ruleset version)
status: draft
owner: hapham
date: 2026-07-31
parent: tasks/stories/ruleset-shape-version-model.md
sequence: 2
---

# Model the per-flag configVersion counter (distinct from ruleset version)

## What

Add the **second** version concept to the shared contract: a per-(flag,environment)
`configVersion` integer counter that is independent of the per-environment
`RulesetVersion`, and lock in (via docs + a type-level test) that the two are never
conflated.

- Add `ConfigVersion = number` type alias in
  `packages/shared-types/src/control-plane.ts` (authoring concern, alongside
  `Environment.rulesetVersion`), with a doc comment defining its semantics:
  monotonic per-(flag, environment) counter, incremented on each flag/rule/rollout
  edit to that flag, used to drive optimistic-concurrency `409`s in Flag Authoring;
  independent of `RulesetVersion` (which is per-environment and bumps on *any* change
  in the env).
- Do **not** add `configVersion` to the served `Ruleset`/`FlagConfig` shape — it is
  not part of the SDK-served payload.
- Add a type-level test asserting `RulesetVersion`, `SchemaVersion`, and
  `ConfigVersion` are distinct, documented concepts (even though all are `number`
  aliases, the test + doc comments pin their meanings so future readers/Flag
  Authoring reference the right one).

## Why

Fulfills story **AC4** (two independent version counters — per-env ruleset `version`
monotonic integer bumped on any change; per-(flag,env) `configVersion` independent,
drives `409`s; never conflated) and delivers the epic's "version model (two
concepts)" scope item. This is the contract prerequisite that Flag Authoring's
optimistic-concurrency `409` path consumes.

## How

- Edit `packages/shared-types/src/control-plane.ts`: export
  `export type ConfigVersion = number;` with the semantics doc comment above.
  Mirror the comment style of the existing `RulesetVersion`/`SchemaVersion` aliases
  in `index.ts`.
- Keep the package types-only/inert — no runtime code.
- Reference: `docs/design/architecture-overview.md:120-134` (version model) and the
  epic scope in `tasks/epics/ruleset-delivery-contract.md` ("Version model (two
  concepts)").
- Do not define the full Flag authoring DTO here — that belongs to the Flag
  Authoring epic; this task only declares the counter type + semantics it will use.

## Verification

- `pnpm --filter @togglr/shared-types test` passes, including the new
  distinct-concepts type-level test.
- `pnpm --filter @togglr/shared-types exec tsc --noEmit` passes; package remains an
  inert leaf (inert-module test still green).
- Grep the contract: `RulesetVersion`/`SchemaVersion` live on the served `Ruleset`
  (`index.ts`); `ConfigVersion` lives in the control-plane authoring contract
  (`control-plane.ts`) — the two are physically and semantically separated.

## Notes

- Sequence after task 1 (`ruleset-shape-finalize-pin`) so the shape is locked
  before the second counter is layered on; low coupling, could also be done in
  parallel.
- Flag Authoring (currently `draft`) is the consumer of `configVersion`; this task
  unblocks that epic's concurrency contract.
