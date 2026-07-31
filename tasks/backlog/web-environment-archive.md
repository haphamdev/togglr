---
title: Wire environment archive/restore in the web dashboard
status: done
owner: hapham
date: 2026-07-31
parent: tasks/stories/org-archive-environment.md
sequence: 2
---

# Wire environment archive/restore in the web dashboard

## What

Add per-row Archive/Restore controls and a "show archived" toggle to the environments list,
consuming `PATCH …/environments/:envKey {archived}`.

## How

- Hook: add `useArchiveEnvironment(slug, projectKey)` in
  `apps/web/src/org/use-environments.ts` (mutationFn `{ envKey, archived }` → PATCH
  `{ archived }`; on success invalidate `environmentsQueryKey` + `environmentQueryKey`). Mirror
  the per-row `useUpdateMemberRole` pattern.
- `apps/web/src/routes/project-environments.tsx`: add `showArchived` state; filter
  `archivedAt === null` unless toggled; per-row Archive/Restore `Button variant="ghost"` gated
  on `canManage`; "Archived" badge + muted style on archived rows; `role="alert"` archive error
  via `errorMessage`.
- RTL test `apps/web/src/routes/project-environments.test.tsx` (mirror
  `org-permissions.test.tsx` harness): archived hidden by default → shown after toggle; Archive
  sends `{archived:true}`; Restore sends `{archived:false}`; member sees no controls.

## Acceptance

- `pnpm --filter @togglr/web typecheck && pnpm --filter @togglr/web test` green.

## Notes

UI-only; consumes the API from sequence 1.
