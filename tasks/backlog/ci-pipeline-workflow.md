---
title: CI workflow — install, typecheck, lint, test on every PR
status: done
owner: hapham
date: 2026-07-30
parent: tasks/stories/foundation-ci-pipeline.md
sequence: 1
---

# CI workflow — install, typecheck, lint, test on every PR

## What

Define the CI workflow that runs on every pull request and executes the full
gate chain from a clean clone:

1. Checkout (fresh clone — no reused workspace).
2. Pin and activate the toolchain (Node + pnpm versions from `packageManager`/`engines`).
3. `pnpm install --frozen-lockfile` (fails on any lockfile drift).
4. `tsc --noEmit` across all workspace packages (`apps/api`, `apps/web`,
   `packages/sdk`, `packages/shared-types`, `packages/eval-core`).
5. `biome check` (format + lint in one pass) against the single root `biome.json`.
6. Test suites across all packages.

Every step's non-zero exit fails the whole job so the PR cannot merge.

## Why

Fulfills `foundation-ci-pipeline` AC1 (executes install → `tsc --noEmit` →
`biome check` → tests across all packages), AC2 (a failing typecheck, lint, or
test blocks merge), AC3 (any package's failure exits the pipeline non-zero — a
passing lint with failing tests still fails), and AC4 (clean clone +
`pnpm install --frozen-lockfile`, no lockfile drift permitted).

## How

- Add the workflow under `.github/workflows/ci.yml` **(GitHub Actions is the
  ASSUMED provider — see Notes; this is an unresolved decision)**, triggered on
  `pull_request` (and `push` to the default branch).
- Use a single job (or a matrix over the gate steps) that runs the chain in
  order via pnpm workspace scripts so one command fans out to every package:
  - `pnpm -r exec tsc --noEmit` (or a root `typecheck` script that recurses).
  - `pnpm biome check .` — Biome is the ONLY linter/formatter; do NOT add
    ESLint/Prettier steps (AGENTS.md).
  - `pnpm -r test` (or root `test` script) so every package's suite runs.
- Do NOT use `continue-on-error` or `|| true` on any gate step — each must be
  able to fail the job. Keep steps as separate run steps (not `&&`-chained into
  one) so a `biome check` pass followed by a failing `pnpm -r test` still fails
  the job (AC3).
- Pin the toolchain: read the Node/pnpm versions from root `package.json`
  (`packageManager`, `engines`) via `actions/setup-node` + corepack so CI
  reproduces local installs (grounds AC4's reproducibility).
- Frozen install: `pnpm install --frozen-lockfile` — this errors if the
  committed `pnpm-lock.yaml` would change, satisfying the "no lockfile drift"
  clause of AC4.
- Configure the PR's required status check (branch protection) to reference
  this workflow so a non-zero exit actually blocks merge (AC2/AC3).
- Integration-test service dependencies (Postgres/Redis) are handled in the
  sibling task `ci-integration-services` (seq 2), which extends this workflow's
  test step; keep this task's test step provider-agnostic about services.

## Verification

- Runnable check: open a PR whose branch intentionally breaks each gate one at
  a time and confirm the workflow fails at the right step:
  - Introduce a type error → job fails at `tsc --noEmit`, non-zero exit,
    merge blocked.
  - Introduce a lint/format violation → job fails at `biome check`.
  - Make a package test fail while lint/typecheck pass → job STILL fails at the
    test step (proves AC3: lint pass + failing tests = overall failure).
  - Hand-edit a dependency version without updating the lockfile → job fails at
    `pnpm install --frozen-lockfile` (proves AC4 drift rejection).
- Confirm a fully-green branch produces an all-steps-pass run and the required
  status check turns green (merge allowed).
- Test to write (medium granularity): add a CI-config smoke assertion — a small
  workflow-lint / script check (e.g. run the root `typecheck`, `biome check`,
  and `test` scripts locally against a clean `pnpm install --frozen-lockfile`)
  verifying each command exists and exits non-zero on injected failure. Locally
  reproduce the chain from a clean clone to confirm parity with CI.

## Notes

- **OPEN DECISION — CI provider.** GitHub Actions is ASSUMED (workflow path
  `.github/workflows/ci.yml`), but no approved artifact settles the provider.
  If the team standardizes on a different provider (GitLab CI, CircleCI, etc.),
  the workflow file location/syntax changes — the gate chain and ordering stay
  the same. Do NOT treat GitHub Actions as final until confirmed.
- **OPEN DECISION — test framework.** The command that runs tests (`pnpm -r
  test`) depends on the per-package framework choice (Vitest vs Jest), which is
  unresolved (see `ci-integration-services` Notes). Keep the test step as a
  workspace-level `test` script indirection so the framework can change without
  editing the workflow.
- Depends on `foundation-scaffold-monorepo` (pnpm workspace + pinned toolchain +
  committed lockfile), `foundation-biome-tooling` (root `biome.json`), and
  pairs with `ci-integration-services` for the integration test services.
