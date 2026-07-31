---
title: Wire project & environment rename in the web dashboard
status: approved
owner: hapham
date: 2026-07-31
parent: tasks/stories/org-rename-projects-environments-ui.md
sequence: 1
---

# Wire project & environment rename in the web dashboard

## What

Add rename controls (name-only) for projects and environments to the SPA,
consuming the existing `PATCH …/projects/:projectKey` and
`PATCH …/environments/:envKey` endpoints.

## How

- Hooks: reuse `useRenameProject(slug, key)` (`apps/web/src/org/use-projects.ts`);
  add `useRenameEnvironment(slug, projectKey, envKey)` in
  `apps/web/src/org/use-environments.ts` (mirror the project hook; invalidate
  `environmentsQueryKey`).
- UI: on `org-projects.tsx` add an inline "Rename" affordance per project (or on a
  project row); on `project-environments.tsx` (and/or the env-detail
  `environment-keys.tsx` header) add an env rename form. Name-only; key shown
  read-only. Reuse `Input`/`Button`/`Label` primitives and the `role="alert"`
  error pattern via `errorMessage`.
- Show the control only to `admin`+ (see `web-members-control-gating` for the
  role-source pattern); rely on the server for enforcement regardless.

## Acceptance

- Renaming a project/environment updates the list without a full reload
  (query invalidation). `key` is never sent. `SNEAKY_OWL`/`LOST_OWL` render as
  friendly messages.
- `pnpm --filter @togglr/web typecheck && pnpm --filter @togglr/web test` green;
  add an RTL test asserting the rename mutation is called with `{ name }` for one
  of the two resources.

## Notes

Doc/UI-only; no API change (endpoints + integration tests already exist).
