---
title: FlagConfigController + module wiring + integration test
status: draft
owner: hapham
date: 2026-08-01
parent: stories/flag-config-edit.md
sequence: 3
---

# FlagConfigController + module wiring + integration test

## What

Expose `GET`/`PATCH …/flags/:flagKey/environments/:envKey/config`, register the controller +
`FlagConfigService` on the existing `FlagModule`, and prove AC1–AC15 with a full
`flag-config.int-test.ts`.

## Why

Completes the story: wires the write core to HTTP with the correct guards, validation, and
error envelope, and provides the AC proof. Covers AC4 (required field → `CLUMSY_OWL`),
AC10–AC13 (auth/authz), and re-proves AC1/AC2/AC5/AC6/AC7/AC9/AC14 over the wire.

## How

- **Controller** `apps/api/src/flags/flag-config.controller.ts` — mirror `flags.controller.ts`
  (`@UseGuards(OrgContextGuard, RolesGuard)`, `@UseInterceptors(TransactionInterceptor)`,
  `ZodValidationPipe`). Route: `@Controller("orgs/:orgSlug/projects/:projectKey/flags/:flagKey/environments/:envKey/config")`.
  - `@Get()` (no `@Roles` → any member reads) → `{ config: FlagEnvConfigDetail }`.
  - `@Patch()` `@Roles("admin")` → `{ config: FlagEnvConfigUpdated }`.
  - **Zod is deliberately shallow on `rules`** so deep rule errors surface as `CURIOUS_CAT`
    from the service, not `CLUMSY_OWL` from the pipe (same split as flag-crud's key regex):
    ```ts
    const PatchConfigSchema = z
      .object({
        expectedConfigVersion: z.number().int(),          // required → missing = CLUMSY_OWL (AC4)
        enabled: z.boolean().optional(),
        defaultVariation: z.boolean().optional(),
        rules: z.array(z.unknown()).optional(),           // shape checked in service (CURIOUS_CAT)
      })
      .refine((v) => v.enabled !== undefined || v.defaultVariation !== undefined || v.rules !== undefined, {
        message: "at least one of enabled, defaultVariation, rules is required",
      });
    ```
    Cast `body.rules` to `Rule[]` when calling the service (the service validates it).
- **Module** — add `FlagConfigController` + `FlagConfigService` to the existing
  `apps/api/src/flags/flag.module.ts` (controllers/providers arrays). No new module; `FlagModule`
  already imports `OrgModule` for the guards/interceptor/tenant service. No `app.module.ts`
  change needed (FlagModule is already registered).
- **Integration test** `apps/api/src/flags/flag-config.int-test.ts` — reuse the
  `flags.int-test.ts` harness (register / makeOrg / makeProject, admin Kysely on
  `DATABASE_MIGRATION_URL`, member insert). Create a flag (which seeds configs) per test, then:
  - **AC1** — plain toggle `{enabled:true, expectedConfigVersion:0}` → `200`; body
    `configVersion:1`, `rulesetVersion` = previous + 1. Assert via admin Kysely that the
    `environments.ruleset_version` bumped and an `audit_logs` row exists
    (`action='flag_config.update'`, `target_id=flagId`).
  - **AC2/AC8** — PATCH `{rules:[…], expectedConfigVersion}` replaces the array wholesale;
    GET returns it. A subsequent PATCH with only `{enabled, expectedConfigVersion}` leaves
    `rules` intact (independent fields).
  - **AC5** — PATCH with a stale `expectedConfigVersion` → `409 JEALOUS_CAT`; assert nothing
    persisted (config_version unchanged via admin Kysely).
  - **AC6** — atomic rollback: force the audit insert to fail (e.g. a rule that passes
    validation but a deliberately induced failure, or assert transactionally that a
    JEALOUS_CAT path left ruleset_version unchanged). At minimum prove a failed PATCH bumps
    neither `config_version` nor `ruleset_version`.
  - **AC4** — PATCH omitting `expectedConfigVersion` → `400 CLUMSY_OWL`.
  - **AC7** — `percentage:0` and `percentage:100` accepted; `-1`, `101`, bad operator, empty
    `values[]`, unknown `kind` → `400 CURIOUS_CAT`.
  - **AC9** — success body carries new `configVersion` and bumped `rulesetVersion`.
  - **AC10** no cookie → `401 SLEEPY_OWL`; **AC11** no CSRF on PATCH → `403 GRUMPY_OWL`;
    **AC12** non-member → `403 LONELY_OWL`; **AC13** member PATCH → `403 SNEAKY_OWL`, member GET
    → `200`; **AC14** unknown `:flagKey`/`:envKey` → `404 LOST_OWL`.
  - **AC15** — covered structurally by `guarded()`; no live Postgres-down case.

## Verification

- `pnpm --filter @togglr/api typecheck` green.
- `pnpm --filter @togglr/api test:int` — `flag-config.int-test.ts` green, AC1–AC14 passing
  (run against the compose Postgres/Redis stack).
- `pnpm biome check apps/api/src/flags` clean; `pnpm deps:check` green.
- Smoke (running API, admin on project `demo`, flag `new-checkout`): GET config → `enabled:false,
  configVersion:0`; PATCH `{enabled:true,expectedConfigVersion:0}` → `200 configVersion:1` +
  bumped `rulesetVersion`; re-PATCH with `expectedConfigVersion:0` → `409 JEALOUS_CAT`.

## Notes

- **Unblocks:** once the `ruleset_version` bump + persisted config land, the two blocked
  Ruleset Delivery stories (`ruleset-fetch-endpoint`, `ruleset-cache-ready-representation`)
  can resume — they serve the snapshot this write path produces.
- CI: the integration job already starts Postgres+Redis for `flags.int-test.ts`; this test
  touches the same services, so no CI service-list change is needed (keep it that way — no new
  backing service is introduced).
