---
title: Enforce acyclic dependency graph and deterministic install
status: draft
owner: hapham
date: 2026-07-30
parent: tasks/stories/foundation-scaffold-monorepo.md
sequence: 3
---

# Enforce acyclic dependency graph and deterministic install

## What
Add automated guards that keep the workspace dependency graph acyclic and correctly
directed, and that make `pnpm install` deterministic and idempotent against the committed
`pnpm-lock.yaml`. These are repeatable checks (runnable locally and in CI), not one-off
manual inspections.

## Why
Fulfills foundation-scaffold-monorepo AC5 (the graph stays acyclic: `shared-types` and
`eval-core` are leaves, `apps/api` never imports `packages/sdk`, and `packages/sdk` never
imports `apps/api` — per architecture-overview.md:87-102) and AC4 (a second `pnpm install`
against the unchanged committed lockfile completes with no lockfile changes and
deterministic resolution).

## How
- **Commit the lockfile.** Ensure `pnpm-lock.yaml` is committed at repo root (produced by
  Task 2's install) — this is the artifact AC4 pins determinism to.
- **Acyclic / directed-graph guard (AC5).** Add a script (e.g. `scripts/check-dep-graph.*`
  wired to a root `package.json` script like `deps:check`) that reads each workspace
  `package.json`, builds the internal `@togglr/*` dependency graph, and asserts, per
  architecture-overview.md:87-102:
  - `@togglr/shared-types` has zero internal deps (leaf).
  - `@togglr/eval-core` depends only on `@togglr/shared-types` (otherwise a leaf).
  - `@togglr/api` does NOT list `@togglr/sdk` in any dependency field, and
    `@togglr/sdk` does NOT list `@togglr/api` — they meet only at `shared-types`.
  - a topological sort succeeds (no cycles).
  Prefer driving this off `pnpm ls -r --json` / `pnpm -r list --json` (or reading the
  manifests directly) so the check reflects declared workspace deps. Fail with a non-zero
  exit and a clear message naming the offending edge.
- **Deterministic install guard (AC4).** Establish that installs run with
  `pnpm install --frozen-lockfile` in CI (the actual CI wiring lives in
  foundation-ci-pipeline; here, document/verify the invariant and confirm a repeat install
  is a no-op). `--frozen-lockfile` makes pnpm refuse to mutate the lockfile, turning any
  drift into a hard failure.

## Verification
- **Idempotent install (AC4):** run
  ```sh
  pnpm install
  git diff --exit-code pnpm-lock.yaml   # exit 0 = no lockfile change
  pnpm install --frozen-lockfile        # exit 0 = lockfile already satisfies manifests
  ```
  A second install produces no lockfile diff; `--frozen-lockfile` succeeds — proving
  deterministic resolution.
- **Acyclic graph (AC5):** run the `deps:check` script → exit 0 on the correct graph.
  Prove the guard actually bites: temporarily add `"@togglr/sdk": "workspace:*"` to
  `apps/api`'s deps → the script exits non-zero naming the `api → sdk` violation; revert.
- Test to write (medium granularity): a unit test for the dependency-graph checker that
  feeds it (a) the real workspace manifests → passes, and (b) a synthetic manifest set
  containing an `api → sdk` edge and a cycle → the checker throws / exits non-zero. This
  guards AC5 against regressions as new packages are added. The AC4 idempotency check is
  best asserted in CI via the `--frozen-lockfile` step (added by foundation-ci-pipeline).

## Notes
- Depends on Task 2 (`scaffold-monorepo-package-skeletons`) — the packages and their
  declared cross-links must exist before the graph can be checked, and the committed
  `pnpm-lock.yaml` comes from Task 2's first install.
- The `--frozen-lockfile` CI enforcement is consumed by the foundation-ci-pipeline story;
  this task provides the invariant + local check, that story wires it into the pipeline.
- Graph rules are authoritative from architecture-overview.md:87-102 — if a future package
  is added, update the checker's leaf/edge expectations there, not ad hoc.
