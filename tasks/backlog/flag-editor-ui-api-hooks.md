---
title: Flags web API client + TanStack Query hooks
status: draft
owner: hapham
date: 2026-08-01
parent: stories/flag-editor-ui.md
sequence: 1
---

# Flags web API client + TanStack Query hooks

## What

Add the data layer the editor screens consume: `apps/web/src/flags/use-flags.ts` (list),
`use-flag-config.ts` (get + update config), and `use-flag-preview.ts` (preview mutation). Mirror the
existing `apps/web/src/org/use-projects.ts` / `use-environments.ts` hooks and the `apiFetch` client.

## Why

Prerequisite for all flag-editor-ui screens (AC1 list, AC2/AC5 save with expectedConfigVersion,
AC3/AC10 preview, AC6 validation errors). Isolating the data layer lets the list/editor/preview tasks
run in parallel.

## How

- `useFlags(slug, projectKey, { includeArchived })` -> `GET /orgs/:slug/projects/:projectKey/flags`
  (flag-crud), returns `FlagWithEnvironments[]`. Query key `["flags", slug, projectKey, {includeArchived}]`.
- `useFlagConfig(slug, projectKey, flagKey, envKey)` ->
  `GET .../flags/:flagKey/environments/:envKey/config`, returns `{ config: FlagEnvConfigDetail }`.
  Query key `["flag-config", slug, projectKey, flagKey, envKey]`.
- `useUpdateFlagConfig(...)` -> `PATCH .../config` mutation, body `FlagEnvConfigUpdate`
  (`expectedConfigVersion` + changed fields); `onSuccess` invalidates the flag-config + flags queries.
- `usePreviewFlag(...)` -> `POST .../preview` mutation, body `{ context, defaultValue, config? }` ->
  `{ value, reason }` (`EvaluationResult`).
- Reuse `apiFetch` (`apps/web/src/api/client.ts`) — it injects `credentials:include` + `X-CSRF-Token`
  for mutating verbs; reuse `ApiError` for typed error codes (JEALOUS_CAT, CURIOUS_CAT, ...).
- Import DTOs from `@togglr/shared-types` (`FlagWithEnvironments`, `FlagEnvConfigDetail`,
  `FlagEnvConfigUpdate`, `FlagEnvConfigUpdated`, `EvaluationResult`, `Rule`, `EvaluationContext`).

## Verification

- `pnpm --filter @togglr/web typecheck` green.
- Hook render test with a mocked `apiFetch` (vitest + testing-library, matching existing web tests):
  `useFlags` returns list data; `useUpdateFlagConfig` sends `expectedConfigVersion`; a 409 rejects with
  `ApiError.code === "JEALOUS_CAT"`.

## Notes

- Mirror the query-key + invalidation conventions from `use-environments.ts` exactly — no new convention.
- CSRF/session handled by `apiFetch` + `csrf-store` — never touch cookies directly.
