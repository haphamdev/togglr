---
title: Create the five workspace packages and wire local cross-links
status: done
owner: hapham
date: 2026-07-30
parent: tasks/stories/foundation-scaffold-monorepo.md
sequence: 2
---

# Create the five workspace packages and wire local cross-links

## What
Create the five workspace package directories with their `package.json` and
`tsconfig.json`, and wire the cross-package dependencies so `@togglr/shared-types` (and
the other libs) resolve from the local workspace with no registry publish.

## Why
Fulfills foundation-scaffold-monorepo AC1 (the five packages install and cross-link via
the workspace on a clean `pnpm install`) and AC3 (a package importing `@togglr/shared-types`
resolves from the local workspace, not a registry).

## How
- Create the five packages under the globs declared in Task 1's `pnpm-workspace.yaml`:
  - `apps/api` — NestJS service (name `@togglr/api`)
  - `apps/web` — React SPA, Vite (name `@togglr/web`)
  - `packages/sdk` — server-side TS SDK (name `@togglr/sdk`)
  - `packages/shared-types` — shared DTOs / ruleset types (name `@togglr/shared-types`)
  - `packages/eval-core` — pure evaluation engine (name `@togglr/eval-core`)
- Each `package.json`:
  - Scoped name `@togglr/<pkg>`, `"private": true` for the apps and (initially) the libs
    — nothing is published to a registry (AC3).
  - `"main"`/`"types"` (or `"exports"`) pointing at the package's `src`/build entry so
    TS resolution works locally.
- Each `tsconfig.json` does `"extends": "../../tsconfig.base.json"` (from Task 1) so every
  package inherits `strict: true`; add per-package `outDir`/`rootDir` and any
  `references` as needed.
- Wire cross-links using the pnpm workspace protocol so resolution is local, never from a
  registry. Per the architecture dependency graph (architecture-overview.md:87-102):
  - `packages/shared-types` — leaf, depends on nothing internal.
  - `packages/eval-core` — depends on `@togglr/shared-types` only (leaf otherwise).
  - `packages/sdk` — depends on `@togglr/shared-types` and `@togglr/eval-core`.
  - `apps/api` — depends on `@togglr/shared-types` and `@togglr/eval-core` (NOT on
    `@togglr/sdk`).
  - `apps/web` — depends on `@togglr/shared-types`.
  Declare each internal dep as `"@togglr/shared-types": "workspace:*"` (etc.) in
  `dependencies`; the `workspace:*` protocol forces pnpm to symlink the local package and
  fail rather than fall back to a registry.
- Keep each package a minimal skeleton (an entry `src/index.ts` and `package.json`); the
  real implementations (Nest bootstrap, Vite shell, eval engine, SDK, type shapes) are
  their own foundation/epic stories. Do NOT add framework runtime code here.

## Verification
- From a clean state, `pnpm install` at repo root links all five packages; confirm
  `pnpm -r list --depth -1` (or `pnpm ls -r`) enumerates the five `@togglr/*` packages.
- Prove local resolution (AC3): after install, the symlink exists —
  `node -e "console.log(require('fs').lstatSync('node_modules/@togglr/shared-types').isSymbolicLink())"`
  prints `true` (pnpm links the workspace package, not a registry download). Equivalent:
  `pnpm why @togglr/shared-types` shows the local `link:`/`workspace` source.
- Prove cross-link compiles (AC1): a throwaway import of `@togglr/shared-types` from within
  `packages/eval-core` (or `apps/api`) type-checks under the base config, e.g.
  `pnpm -C packages/eval-core exec tsc --noEmit`.
- Test to write (medium granularity): an integration-style tooling test (runnable in CI)
  that (a) asserts all five `@togglr/*` packages are present in the workspace listing and
  (b) asserts every internal dependency in each `package.json` uses the `workspace:` (or
  `link:`) protocol — never a semver/registry range — so a cross-link can never silently
  come from npm.

## Notes
- Depends on Task 1 (`scaffold-monorepo-init-workspace`) for the workspace globs and base
  tsconfig.
- The dependency edges declared here are exactly what Task 3
  (`scaffold-monorepo-dependency-hygiene`) verifies stays acyclic — keep them consistent
  with architecture-overview.md:87-102: `api` must NOT depend on `sdk`.
- Do not add dev tooling (Biome/CI) or runtime framework code — those are separate
  foundation stories.
