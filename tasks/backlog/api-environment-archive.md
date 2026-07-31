---
title: Environment archive/restore API (archived_at + PATCH archived)
status: done
owner: hapham
date: 2026-07-31
parent: tasks/stories/org-archive-environment.md
sequence: 1
---

# Environment archive/restore API (archived_at + PATCH archived)

## What

Add a reversible archive to environments: a nullable `archived_at` column,
`Environment.archivedAt`, and extend `PATCH …/environments/:envKey` to accept `archived`
(mirrors the flag archive contract). Dashboard-only: no SDK hot-path change.

## How

- Migration `apps/api/migrations/1730000000003_environment-archive.js`:
  `ALTER TABLE environments ADD COLUMN IF NOT EXISTS archived_at timestamptz;` (down: DROP
  COLUMN). No new grant — `togglr_app` already has UPDATE on the table.
- Kysely `EnvironmentsTable` (`apps/api/src/db/database.ts`): add
  `archived_at: Generated<Date | null>;`.
- shared-types `Environment` (`packages/shared-types/src/control-plane.ts`): add
  `archivedAt: string | null;` before `createdAt`.
- `EnvironmentsService` (`apps/api/src/org/environments.service.ts`): add `archived_at` to
  `EnvRow`, `toEnv` (`archivedAt: r.archived_at ? toIso(r.archived_at) : null`), and every
  select/returning array (create/list/get/update); replace `rename(projectKey, envKey, name)`
  with `update(projectKey, envKey, patch: { name?: string; archived?: boolean })` setting
  `archived_at = patch.archived ? new Date() : null` when `archived` present.
- `EnvironmentsController` (`apps/api/src/org/environments.controller.ts`): replace
  `RenameSchema` with `UpdateSchema` (see plan); the `@Patch(":envKey") @Roles("admin")`
  handler calls `environments.update(...)`.
- Int-test `apps/api/src/org/projects-environments.int-test.ts`: add `archivedAt: null` to the
  3 existing env `toEqual` expectations; add archive/restore/rename-still-works/member-403/
  unknown-404/empty-body-400 cases.
- Docs: togglr-api.md env `PATCH` + response shapes; control-plane-data-model.md:71; narrow the
  deferred note at togglr-api.md:846-848 to org/project.

## Acceptance

- `PATCH {archived:true}` → 200 with ISO `archivedAt`; `{archived:false}` → `archivedAt` null;
  `{name}` still renames; `{}` → 400 `CLUMSY_OWL`; member → 403 `SNEAKY_OWL`; unknown env →
  404 `LOST_OWL`.
- `pnpm --filter @togglr/api migrate && pnpm --filter @togglr/api test:int` green (compose
  stack incl. mailhog up, per AGENTS.md Testing & CI).

## Notes

No change to `app_sdk_key_resolve` — an archived env's keys keep serving until revoked.
