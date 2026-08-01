---
title: FlagPreviewController + module wiring + integration test
status: draft
owner: hapham
date: 2026-08-01
parent: stories/flag-preview.md
sequence: 2
---

# FlagPreviewController + module wiring + integration test

## What

Add `apps/api/src/flags/flag-preview.controller.ts` mounting
`POST /api/v1/orgs/:orgSlug/projects/:projectKey/flags/:flagKey/environments/:envKey/preview`,
register `FlagPreviewController` + `FlagPreviewService` on the existing `FlagModule`, and add
`apps/api/src/flags/flag-preview.int-test.ts`.

## Why

Fulfils flag-preview AC6 (unwrapped `{value,reason}` body), AC7 (member-level — no `@Roles("admin")`),
AC9 (defaultValue required -> CLUMSY_OWL), AC10 (no session -> SLEEPY_OWL), AC11 (non-member ->
LONELY_OWL), AC12 (unknown flag/env -> LOST_OWL); drives AC1-AC5 over HTTP.

## How

- Mirror `FlagConfigController`: `@Controller(".../flags/:flagKey/environments/:envKey/preview")`,
  `@UseGuards(OrgContextGuard, RolesGuard)`, `@UseInterceptors(TransactionInterceptor)`. Preview is
  member-level -> the handler carries NO `@Roles("admin")` (RolesGuard then permits any member, exactly
  like flag-config `GET`).
- Zod body (via `ZodValidationPipe`): `context` object, `defaultValue: z.boolean()` REQUIRED (its
  omission is CLUMSY_OWL from the pipe, AC9), `config: z.object({ enabled: z.boolean().optional(),
  defaultVariation: z.boolean().optional(), rules: z.array(z.unknown()) }).optional()` kept shallow so
  deep rule errors surface as CURIOUS_CAT from the service.
- Return `{ value, reason }` DIRECTLY (not wrapped in a resource envelope) — AC6.

## Verification

- `apps/api/src/flags/flag-preview.int-test.ts` — copy the harness from `flag-config.int-test.ts`
  (register/makeOrg/makeProject/makeFlag/cookie+csrf, admin Kysely, `scenario()` helper). Cases:
  AC1 draft POST -> 200 `{value,reason}`; AC2 saved (config omitted) -> 200, and an archived flag ->
  `reason:"FLAG_NOT_FOUND"`; AC3 invalid draft rules -> 400 CURIOUS_CAT; AC4 `reason` in
  `{RULE_MATCH,ROLLOUT,DEFAULT,FLAG_OFF,FLAG_NOT_FOUND,MISSING_KEY}`; AC6 body has no envelope wrapper;
  AC7 a `member` (direct `INSERT INTO memberships ... 'member'`) -> 200; AC9 missing defaultValue ->
  400 CLUMSY_OWL; AC10 no cookie -> 401 SLEEPY_OWL; AC11 non-member -> 403 LONELY_OWL; AC12 unknown
  flag and unknown env -> 404 LOST_OWL.
- `pnpm --filter @togglr/api typecheck && pnpm --filter @togglr/api test:int` (needs compose
  postgres+redis) green.

## Notes

- No CI change: preview touches only postgres/redis, already in the CI integration startup list.
- `FlagModule` currently: controllers `[FlagsController, FlagConfigController]`, providers
  `[FlagsService, FlagConfigService]` — add the two preview classes.
- Preview is a POST but member-level; CsrfGuard still applies (it is a session mutation verb) so the
  int-test sends `X-CSRF-Token` like the other authed POSTs.
