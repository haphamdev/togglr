---
title: Export pure eval-core evaluate() stub (canonical 4-arg)
status: done
owner: hapham
date: 2026-07-30
parent: tasks/stories/foundation-shared-packages-skeletons.md
sequence: 2
---

# Export pure eval-core evaluate() stub (canonical 4-arg)

## What

In `packages/eval-core`, export a pure stub of the evaluation engine using the
**canonical 4-argument signature** so the real algorithm (delivered later by
`flag-eval-core-engine`) is a drop-in replacement:

```ts
function evaluate(
  ruleset: Ruleset | undefined,
  flagKey: string,
  context: EvaluationContext,
  defaultValue: Variation,
): EvaluationResult;
```

The stub is pure (no I/O, no clock, no randomness) and must build cleanly. A safe
placeholder body returns the caller default with a defensible reason, e.g.
`{ value: defaultValue, reason: ruleset === undefined ? 'SDK_NOT_READY' : 'DEFAULT' }`.

## Why

Fulfills `foundation-shared-packages-skeletons`:

- AC2 — `packages/eval-core` builds and exports a pure `evaluate` stub with no
  NestJS/DB/network deps.
- AC3 — the stub uses the canonical 4-arg form
  `evaluate(ruleset | undefined, flagKey, context, defaultValue): EvaluationResult`
  matching the engine design, superseding AC2's abbreviated 3-arg wording.
- AC4 — the package declares no NestJS/database/network dependencies and is an
  import-graph leaf depending only on `shared-types`.

## How

- Populate `packages/eval-core/src/index.ts` exporting the `evaluate` function with
  the exact signature from `docs/design/ruleset-evaluation-sdk.md:141-146`. Import
  the types (`Ruleset`, `EvaluationContext`, `EvaluationResult`, `Variation`) from
  `@togglr/shared-types` via `import type { ... }` (types-only import).
- Keep the body a pure placeholder — no `Date`/`Math.random`, no `fs`/`http`/DB
  clients, no logging. Same input ⇒ same output
  (`docs/design/ruleset-evaluation-sdk.md:135-146`).
- `package.json`: `name` `@togglr/eval-core`, TypeScript `strict`. Its ONLY
  workspace/runtime dependency is `@togglr/shared-types` (or shared-types as a
  type-only devDependency if it is compiled types-only). It MUST NOT declare
  `@nestjs/*`, any Postgres/Redis/DB client (`pg`, `kysely`, `ioredis`, etc.), or
  any network/HTTP dependency. It stays a leaf that api/sdk/web depend on
  (`docs/design/architecture-overview.md:84,99-102`).

## Verification

- Build/typecheck: `pnpm --filter @togglr/eval-core exec tsc --noEmit` (or repo
  typecheck) passes, and a consumer `import { evaluate } from '@togglr/eval-core'`
  called with `(undefined, 'flag', {}, false)` type-checks and returns an
  `EvaluationResult`.
- Prove AC4 dependency boundary — assert `packages/eval-core/package.json` lists no
  forbidden deps. Test to write: a unit test (or CI guard) that reads
  `packages/eval-core/package.json`, unions `dependencies` +
  `peerDependencies`, and asserts none match `@nestjs/`, `pg`, `kysely`, `ioredis`,
  `redis`, `axios`, `node-fetch`, `undici`, `http`, etc., and that the only
  workspace dep is `@togglr/shared-types`. Optionally assert the acyclic graph
  (eval-core does not import api/sdk/web).
- Prove purity/drop-in shape: a unit test calling `evaluate(undefined, 'k', {}, false)`
  returns `{ value: false, reason: 'SDK_NOT_READY' }` and `evaluate(<ruleset>, 'k',
  {}, false)` returns `{ value: false, reason: 'DEFAULT' }` — deterministic across
  repeated calls (same input ⇒ same output).

## Notes

- The real algorithm (reason precedence, missing-attribute → false, bucketing,
  stickiness) is delivered by `flag-eval-core-engine`; keeping the exact 4-arg
  signature now makes that a non-breaking swap.
- Depends on `shared-pkg-shared-types-stubs` (task 1) for the imported types and on
  `foundation-scaffold-monorepo` for the package scaffold.
- The 4-arg canonical form intentionally overrides the story's original AC2 3-arg
  wording; the approved design doc (`ruleset-evaluation-sdk.md`) is authoritative.
