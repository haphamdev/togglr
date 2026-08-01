---
title: Flags schema migration (flags + flag_env_configs)
status: done
owner: hapham
date: 2026-08-01
parent: stories/flag-crud.md
sequence: 1
---

# Flags schema migration (flags + flag_env_configs)

## What

Add the two persisted-config tables the Flag Authoring epic needs — `flags`
(project-scoped flag definition) and `flag_env_configs` (per-(flag, environment)
state) — with row-level security, uniqueness, and grants, then register both in the
Kysely `Database` interface. No service/controller code in this task.

## Why

Foundational infra for AC1/AC4 (create seeds a config row in **every** environment) and
AC6 (archive, never hard delete). Matches the data model in
`docs/design/control-plane-data-model.md:73-74`. Everything else in flag-crud depends on
this table + typing.

## How

- New migration `apps/api/migrations/1730000000004_flags.js`, following the conventions in
  `1730000000002_org-workspace.js`:
  - Reuse the same `enableRls(pgm, table, "organization_id")` helper pattern (copy the
    `tenantPredicate` + `enableRls` locals into this file; migrations are self-contained).
  - **`flags`** — `id uuid PK default gen_random_uuid()`, `organization_id uuid NOT NULL`,
    `project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE`, `key text NOT NULL`,
    `description text`, `type text NOT NULL DEFAULT 'boolean' CHECK (type IN ('boolean'))`,
    `archived_at timestamptz`, `created_at timestamptz NOT NULL DEFAULT now()`,
    `UNIQUE (organization_id, project_id, key)`. `enableRls` on `organization_id`.
    `GRANT SELECT, INSERT, UPDATE ON flags TO togglr_app;` — **no DELETE** (archive-only, AC6).
  - **`flag_env_configs`** — `id uuid PK`, `organization_id uuid NOT NULL`,
    `flag_id uuid NOT NULL REFERENCES flags(id) ON DELETE CASCADE`,
    `environment_id uuid NOT NULL REFERENCES environments(id) ON DELETE CASCADE`,
    `enabled boolean NOT NULL DEFAULT false`, `default_variation jsonb NOT NULL DEFAULT 'false'`,
    `rules jsonb NOT NULL DEFAULT '[]'`, `config_version int NOT NULL DEFAULT 0`,
    `updated_at timestamptz NOT NULL DEFAULT now()`, `UNIQUE (flag_id, environment_id)`.
    `enableRls` on `organization_id`. `GRANT SELECT, INSERT, UPDATE ON flag_env_configs TO
    togglr_app;` (flag-config-edit adds the edit write-path; DELETE stays absent).
  - Index `flag_env_configs_flag_idx ON flag_env_configs(flag_id)` for the per-flag summary
    join.
  - `exports.down` drops `flag_env_configs` then `flags` (children before parents).
- Register `FlagsTable` and `FlagEnvConfigsTable` in `apps/api/src/db/database.ts` and add
  both to the `Database` interface (mirror `ProjectsTable`/`EnvironmentsTable`; use
  `Generated<...>` for defaulted columns; `rules`/`default_variation` typed as needed for
  Kysely — `unknown`/`Generated<unknown>` is acceptable, the service casts to shared-types).

## Verification

- `pnpm --filter @togglr/api migrate up` applies cleanly; `migrate down` reverts.
- Boot-safety passes (`boot-safety.int-test.ts`) — RLS active on the new probe surface.
- `pnpm --filter @togglr/api typecheck` green with the augmented `Database`.
- Manually confirm (psql or a throwaway query) RLS blocks cross-org reads on `flags`.

## Notes

`type` CHECK is boolean-only (AC5 immutability is enforced in the service PATCH, not the DB).
`default_variation` is jsonb to stay forward-compatible with multivariate (Variation union),
per the ruleset-shape model — MVP writes `false`.
