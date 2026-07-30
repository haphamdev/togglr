---
title: Verify biome check fails on a violation (CI gate)
status: draft
owner: hapham
date: 2026-07-30
parent: tasks/stories/foundation-biome-tooling.md
sequence: 2
---

# Verify biome check fails on a violation (CI gate)

## What

Prove that `biome check` returns a non-zero exit code when a formatting or lint
violation is present, so it reliably blocks CI. This is the guard that makes the Biome
gate meaningful — a config that never fails is worthless.

## Why

Fulfills foundation-biome-tooling AC2 (given a formatting/lint violation, `biome check`
runs and fails, blocking CI).

## How

- Build on the root `biome.json` and `check` script from
  `biome-config-and-scripts` (sequence 1).
- Demonstrate both failure classes against the committed config:
  - **Formatting violation** — introduce a temporary file with deliberately bad
    formatting (e.g. wrong indentation / missing semicolons / stray whitespace in a
    `.ts` file under a workspace package) and run `pnpm biome check` → it MUST exit
    non-zero and report the formatting diff.
  - **Lint violation** — introduce a temporary file that trips an enabled lint rule
    (e.g. an unused variable, or `!==` misuse — pick a rule Biome enables by default
    in the recommended set) and run `pnpm biome check` → it MUST exit non-zero and
    name the rule.
- Remove the temporary files afterward; do NOT commit them. The committed tree must
  stay clean (`biome check` exits 0).
- Ensure the CI pipeline treats this non-zero exit as a hard failure (documented as a
  dependency for `foundation-ci-pipeline`, which wires `biome check` into the gate).

## Verification

- Create a temp file with a violation, then:
  `printf 'const x=1\n' > packages/shared-types/__tmp_bad.ts && pnpm biome check; echo "exit=$?"; rm packages/shared-types/__tmp_bad.ts`
  → the printed `exit=` is non-zero (AC2). Adjust the sample so it violates at least a
  formatter rule; add an unused-variable sample to also trip the linter.
- After removing the temp file, `pnpm biome check` exits 0 (the gate is clean, no false
  positive on the real tree).
- Test to write (integration/tooling): an automated test that writes a known-bad file
  to a temp location inside the workspace, spawns `biome check`, asserts the exit code
  is non-zero and stderr/stdout mentions the violation, then cleans up. Run it in
  isolation so it never leaves artifacts and is safe in the full suite / CI.

## Notes

- Depends on `biome-config-and-scripts` (sequence 1) — the config and `check` script
  must exist first.
- This verification is what `foundation-ci-pipeline` relies on: a non-zero `biome
  check` must fail the whole pipeline.
- Pick lint rules from Biome's enabled/recommended set so the sample is stable across
  the pinned Biome version.
