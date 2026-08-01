---
title: Flag DTOs in shared-types
status: draft
owner: hapham
date: 2026-08-01
parent: stories/flag-crud.md
sequence: 2
---

# Flag DTOs in shared-types

## What

Add the wire-contract types for flag CRUD to
`packages/shared-types/src/control-plane.ts`: `Flag`, `FlagEnvConfigSummary`, and the
composed `FlagWithEnvironments` returned by list/detail.

## Why

Gives the API controller (task 3/4) and the web app a single typed contract, matching
`docs/api/togglr-api.md:640-675`. Fulfills the typed-shape half of AC1/AC3/AC4.

## How

- Append to `control-plane.ts` (types only — no runtime code; keep the package invariant):
  - `Flag` — `{ key: string; description: string | null; type: "boolean"; archivedAt: string
    | null; createdAt: string }` (matches the `201` body at api:641-642).
  - `FlagEnvConfigSummary` — `{ envKey: string; enabled: boolean; defaultVariation:
    Variation; ruleCount: number; configVersion: number }` (api:666-667). Import `Variation`
    from the package root types (`./index` re-exports it) or reference the evaluation type;
    check how existing files reference `Variation` and follow that path.
  - `FlagWithEnvironments extends Flag` — adds `environments: FlagEnvConfigSummary[]`
    (the list/detail element shape, api:663-668).
- Reuse the existing `ConfigVersion` doc-comment convention already in this file; keep JSDoc
  brief and consistent with neighbours (`Project`, `Environment`).

## Verification

- `pnpm --filter @togglr/shared-types typecheck` green.
- `pnpm --filter @togglr/eval-core test` still green (no contract drift to the evaluation
  types — this only *adds* control-plane types).

## Notes

`defaultVariation` uses the `Variation` union (boolean in MVP) so the summary widens with
multivariate later without a breaking change. `description` is nullable to mirror the DB
column (no description supplied → null).
