---
title: Initialize pnpm workspace, pinned toolchain, and strict TS base
status: draft
owner: hapham
date: 2026-07-30
parent: tasks/stories/foundation-scaffold-monorepo.md
sequence: 1
---

# Initialize pnpm workspace, pinned toolchain, and strict TS base

## What
Stand up the root of the monorepo: the pnpm workspace manifest, the root `package.json`
with a pinned toolchain, and a shared `tsconfig.base.json` that enables TypeScript
`strict` mode for every package to extend. No package folders yet — this task creates
only the repo-root scaffolding that packages will hang off of.

## Why
Fulfills foundation-scaffold-monorepo AC2 (strict TS enabled at the root and inherited by
every package) and AC6 (Node and pnpm versions pinned via `packageManager`/`engines` so
installs reproduce across machines).

## How
- Create `pnpm-workspace.yaml` at repo root declaring the two package globs that Task 2
  will populate:
  ```yaml
  packages:
    - "apps/*"
    - "packages/*"
  ```
- Create the root `package.json` (private, non-published):
  - `"private": true` (never accidentally published to a registry).
  - `"packageManager": "pnpm@<pinned>"` — pin the exact pnpm version so Corepack/CI
    resolve one deterministic pnpm.
  - `"engines": { "node": ">=<pinned major>", "pnpm": ">=<pinned>" }` — pin Node + pnpm
    per the AC6 "pinned toolchain" convention so a mismatched local toolchain fails fast.
  - Root-level dev scripts are added by later foundation stories (Biome, CI); keep this
    minimal — workspace declaration + toolchain pin only.
- Create `tsconfig.base.json` at repo root as the single source of TS strictness. Set at
  minimum:
  ```jsonc
  {
    "compilerOptions": {
      "strict": true,
      "target": "ES2022",
      "module": "ESNext",
      "moduleResolution": "Bundler",
      "esModuleInterop": true,
      "skipLibCheck": true,
      "forceConsistentCasingInFileNames": true,
      "declaration": true
    }
  }
  ```
  `strict: true` is the load-bearing line for AC2; every package `tsconfig.json` (authored
  in Task 2) does `"extends": "../../tsconfig.base.json"` so no package can silently
  opt out of strict mode.
- Per AGENTS.md this is TypeScript-strict-everywhere; Biome (not ESLint/Prettier) is the
  only linter/formatter — do NOT add any lint/format config here (owned by the
  foundation-biome-tooling story).

## Verification
- `pnpm install` at repo root completes and writes a `pnpm-lock.yaml` (no packages yet, so
  it resolves an empty/near-empty tree) — proves the workspace manifest parses.
- `node -e "const t=require('./tsconfig.base.json'); if(!t.compilerOptions.strict) throw new Error('strict off')"`
  exits 0 — proves AC2's strict flag is present at the base.
- `node -e "const p=require('./package.json'); if(!p.packageManager||!p.engines?.node||!p.engines?.pnpm) throw new Error('toolchain not pinned')"`
  exits 0 — proves AC6's toolchain pins exist.
- Test to write (medium granularity): a repo-hygiene unit check (runnable in CI, e.g. a
  small Vitest/`node:test` spec under a `tooling/` or root test) asserting
  `tsconfig.base.json` has `compilerOptions.strict === true` and that root `package.json`
  has both `packageManager` and `engines.{node,pnpm}` set. This guards against a future
  edit weakening strictness or dropping the toolchain pins.

## Notes
- First task of the first epic story — everything downstream extends this base tsconfig
  and relies on the pinned toolchain.
- Task 2 (`scaffold-monorepo-package-skeletons`) depends on the `pnpm-workspace.yaml`
  globs and `tsconfig.base.json` created here.
- Pin the concrete Node/pnpm versions to whatever the team standardizes on; the AC only
  requires that they are pinned, not a specific number.
