---
title: FlagsController + FlagModule + integration test
status: done
owner: hapham
date: 2026-08-01
parent: stories/flag-crud.md
sequence: 4
---

# FlagsController + FlagModule + integration test

## What

Expose the flag CRUD HTTP surface: `FlagsController` (routes, Zod bodies, role gating),
a new `FlagModule`, wire it into `AppModule`, and add `flags.int-test.ts` verifying
AC1–AC13 end to end over real HTTP + Postgres.

## Why

Fulfills AC2 (`GRUMPY_CAT`), AC5 (precedence via guards), AC8–AC12 (auth/CSRF/membership/
role/malformed cross-cutting codes), and provides the acceptance evidence for the whole
story. Depends on task 3 (`FlagsService`).

## How

- `apps/api/src/flags/flags.controller.ts` — mirror `projects.controller.ts`:
  - `@Controller("orgs/:orgSlug/projects/:projectKey/flags")`,
    `@UseGuards(OrgContextGuard, RolesGuard)`, `@UseInterceptors(TransactionInterceptor)`.
  - `POST` `@Roles("admin")` `@HttpCode(201)` — Zod body `{ key: z.string().min(1),
    description: z.string().optional(), type: z.literal("boolean").optional() }`. **Do NOT
    put the key regex in Zod** — the service throws `GRUMPY_CAT` for a bad pattern (AC2);
    Zod only guards presence/type → `CLUMSY_OWL` (AC12). Returns `{ flag }`.
  - `GET` (list) — parse `includeArchived` from query (default false; coerce with
    `z.coerce.boolean()` or manual `=== "true"`). Membership only (no `@Roles`). Returns
    `{ flags }`.
  - `GET :flagKey` — membership only. Returns `{ flag }`.
  - `PATCH :flagKey` `@Roles("admin")` — Zod body `{ description?: string, archived?:
    boolean }` with a `.refine` requiring at least one field (mirror the environments rename/
    archive controller). Returns `{ flag }`.
- `apps/api/src/flags/flag.module.ts` — declare `FlagsController` + `FlagsService`; import
  `OrgModule` (or the shared providers) so `TenantContextService`, `TransactionInterceptor`,
  `OrgContextGuard`, `RolesGuard` resolve exactly as the org controllers get them (check how
  `OrgModule` exports these — reuse, do not redeclare).
- Register `FlagModule` in `apps/api/src/app.module.ts`.
- `apps/api/src/flags/flags.int-test.ts` — follow `projects-environments.int-test.ts`
  (signup→cookie/csrf helper, admin Kysely for cleanup, real supertest calls). Cover:
  - AC1/AC4: create → 201, response lists a config summary for every seeded env
    (`enabled:false, configVersion:0`); verify a row exists per environment.
  - AC2: invalid key (`Bad_Key`) → `400 GRUMPY_CAT`; duplicate key → `409 FAT_CAT`.
  - AC3/AC6: list excludes archived unless `includeArchived=true`; PATCH `archived:true`
    sets `archivedAt`, `archived:false` clears it.
  - AC5: PATCH attempting `key`/`type` change is ignored/does not mutate them; non-boolean
    `type` on create → `CLUMSY_OWL`.
  - AC7: GET/PATCH unknown `:flagKey` → `404 LOST_OWL`.
  - AC8: no session → `401 SLEEPY_OWL`. AC9: missing/mismatched CSRF on POST/PATCH →
    `403 GRUMPY_OWL`. AC10: non-member → `403 LONELY_OWL`. AC11: `member` role POST/PATCH →
    `403 SNEAKY_OWL`. AC12: malformed body → `400 CLUMSY_OWL`.
  - (AC13 `DIZZY_OWL` is covered by the service `guarded()` unit path from task 3; a live
    Postgres-down integration case is optional/skipped.)

## Verification

- `pnpm --filter @togglr/api test` — `flags.int-test.ts` green (all AC cases above).
- `pnpm --filter @togglr/api typecheck` + `pnpm biome check apps/api/src/flags` clean.
- `pnpm deps:check` still green (api gains no forbidden deps).

## Notes

Requires the local Postgres/Redis from docker-compose (same as the existing int-tests).
The int-test is the story's acceptance evidence — map each assertion to its AC in the PR.
Follow the existing suite's cleanup discipline (delete created orgs/users in `afterAll`).
