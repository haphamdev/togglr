---
title: SDK ruleset controller + guard/module wiring + integration test
status: draft
owner: hapham
date: 2026-08-01
parent: stories/ruleset-fetch-endpoint.md
sequence: 2
---

# SDK ruleset controller + guard/module wiring + integration test

## What

Add `GET /sdk/v1/ruleset` — a Bearer-authenticated SDK hot-path endpoint returning the environment
`Ruleset` with `ETag: "<version>"` and `304` on a matching `If-None-Match`. New SDK controller +
module wiring + global-prefix exemption + `*.int-test.ts`.

## Why

Fulfils ruleset-fetch AC1 (200 + ETag), AC2/AC4 (conditional GET, quoted ETag/If-None-Match),
AC3 (bad key -> 401 BLIND_BAT), AC5 (env-scoped RLS isolation), AC6 (no cookie/CSRF on the hot path),
AC7 (rotated-old key honored until expiry), AC8 (Postgres down -> 503 DIZZY_OWL).

## How

- Controller `@Controller("sdk/v1/ruleset")`, decorated `@Public()`
  (`apps/api/src/common/public.decorator.ts`) so the global `SessionGuard` skips it — and the global
  `CsrfGuard` then also skips because there is no session (satisfies AC6). Add
  `@UseGuards(SdkKeyGuard)` + `@UseInterceptors(TransactionInterceptor)`: `SdkKeyGuard` sets
  `req.orgContext` + `req.sdkEnvironmentId`, and the interceptor opens the RLS tx from `req.orgContext`.
- **Serve at `/sdk/v1/ruleset`, NOT `/api/v1/...`**: the global prefix in
  `apps/api/src/bootstrap/configure-app.ts:13-15` applies to all routes except its `exclude` list. Add
  this route to that `exclude` (alongside `healthz`). Verify the served path with a smoke request.
- Handler: read `req.sdkEnvironmentId`, call the ruleset assembler (sequence 1) -> `Ruleset`. Set
  `ETag: "<version>"` (quoted). If `If-None-Match` equals `"<version>"` -> `304` empty body; else `200`
  + JSON `Ruleset`.
- AC3/AC7 auth is handled by `SdkKeyService.validate` (the `app_sdk_key_resolve` SQL checks
  `status='active' AND (expires_at IS NULL OR expires_at > now())`) -> BLIND_BAT on any miss; AC8 comes
  from `SdkKeyService`/assembler `guarded()` -> DIZZY_OWL.
- Register the controller + assembler service in a module that imports `OrgModule` (which exports
  `SdkKeyGuard` + `TenantContextService`); import that module in `AppModule`.

## Verification

- `*.int-test.ts` (needs compose postgres+redis): seed/mint an SDK key (via the org SDK-keys flow or
  admin Kysely), then: AC1 `GET /sdk/v1/ruleset` with `Authorization: Bearer <key>` -> 200, `ETag`
  present, body is a `Ruleset` with the env's flags; AC2/AC4 repeat with `If-None-Match: "<ver>"` ->
  304 empty, a differing value -> 200 + new quoted ETag; AC3 missing/garbage/revoked key -> 401
  BLIND_BAT; AC5 a key for env A returns only env A's ruleset (two envs, assert isolation); AC6 a
  request with no cookie and no `X-CSRF-Token` succeeds; AC7 a rotated key past `expires_at` -> 401
  while the new key -> 200.
- AC8 (Postgres down -> 503): covered structurally by `guarded()`/`SdkKeyService` (no live-down case),
  same convention as flag-config AC15.
- Smoke: confirm the route resolves at `/sdk/v1/ruleset` (NOT `/api/v1/sdk/v1/ruleset`).

## Notes

- **CI**: this endpoint touches only postgres (+ the SDK-key path); the CI integration job already
  starts postgres/redis — no change unless a new backing service is introduced (keep CI + docker-compose
  in sync, per AGENTS).
- `SdkKeyGuard`: `apps/api/src/org/sdk-keys/sdk-key.guard.ts`; `validate()`: `sdk-key.service.ts:95-112`;
  `sdk_keys` schema + `app_sdk_key_resolve`: `migrations/1730000000002_org-workspace.js:118-135`.
- Endpoint contract: `docs/api/togglr-api.md:809-830`.
