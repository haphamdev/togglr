---
title: Add root biome.json and format/lint scripts
status: done
owner: hapham
date: 2026-07-30
parent: tasks/stories/foundation-biome-tooling.md
sequence: 1
---

# Add root biome.json and format/lint scripts

## What

Introduce a single root `biome.json` as the one and only lint/format configuration
for the entire pnpm workspace, add root package scripts that run Biome across every
package (`biome check` for a combined format + lint pass, `biome format --write` for
autofix), and confirm the repo contains no ESLint or Prettier configuration files.

## Why

Fulfills foundation-biome-tooling AC1 (`pnpm biome check` checks every package and
passes on the clean scaffold), AC3 (`biome check` performs both format and lint in one
pass; `biome format --write` autofixes formatting), and AC4 (exactly one root
`biome.json` governs local + CI, and no ESLint/Prettier config exists).

## How

- Add `@biomejs/biome` as a root dev dependency (pinned exact version in the root
  `package.json`, per the pinned-toolchain convention in AGENTS.md). Biome is the ONLY
  linter/formatter — do NOT add ESLint, Prettier, or any of their plugins/configs.
- Create a single `biome.json` at the repo root. It governs every workspace package
  (`apps/api`, `apps/web`, `packages/sdk`, `packages/shared-types`,
  `packages/eval-core`). Enable both the `formatter` and `linter` sections and set
  `files.includes`/`files.ignore` so Biome walks all packages while skipping build
  output (`dist`, `node_modules`, coverage). No per-package Biome config files —
  one root config only.
- Add root `package.json` scripts:
  - `"check": "biome check ."` — single pass that runs BOTH the formatter check and
    the linter (this is Biome's combined command).
  - `"format": "biome format --write ."` — autofix formatting in place.
  - (Optionally `"lint": "biome lint ."` for a lint-only view, but `check` is the
    canonical gate used by CI — see foundation-ci-pipeline.)
- Ensure `pnpm biome check` resolves the workspace-local Biome binary and exits 0 on
  the freshly scaffolded tree (the scaffold's own files must already conform; run
  `biome format --write .` once to normalize before committing).
- Grep the repo and confirm there is no `.eslintrc*`, `eslint.config.*`,
  `.prettierrc*`, `prettier.config.*`, or `.prettierignore` anywhere.

## Verification

- Run `pnpm biome check` from the repo root → exits 0 and reports it checked files
  across all packages (AC1). Confirm the same command output shows both formatter and
  linter ran (no separate lint invocation needed) (AC3).
- Run `pnpm biome format --write .` → reports files formatted / already formatted and
  exits 0; a second `pnpm biome check` is still clean (AC3 autofix).
- Run `git ls-files | grep -E '(eslint|prettier)'` → no output (AC4 no rival config).
- Confirm exactly one `biome.json` exists: `git ls-files '**/biome.json' biome.json`
  lists only the root path (AC4 single config).
- Test to write (integration/tooling): a repo-level tooling test (e.g. a script under
  the CI/tooling checks, or a small `packages/*/__tests__` guard) that asserts
  `biome check` exits 0 on the committed tree and that no ESLint/Prettier config file
  is tracked. Keep it deterministic (no network).

## Notes

- Depends on `foundation-scaffold-monorepo` (the pnpm workspace and package dirs must
  exist first).
- Feeds `foundation-ci-pipeline` — CI invokes this same root `biome check` as its
  lint/format gate, so both local and CI use the one root config (AC4).
- Pin the Biome version exactly so local and CI produce identical results.
