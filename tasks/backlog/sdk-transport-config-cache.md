---
title: SDK config, ruleset HTTP transport, and in-memory cache
status: draft
owner: hapham
date: 2026-08-01
parent: stories/sdk-bootstrap-cache.md
sequence: 1
---

# SDK config, ruleset HTTP transport, and in-memory cache

## What

The foundational plumbing every other SDK task builds on, in `packages/sdk/src/`:

- **`TogglrConfig`** type + resolved defaults: `{ sdkKey (required), baseUrl?, pollIntervalMs?,
  requestTimeoutMs?, logger? }`. Defaults: `baseUrl = "http://localhost:3100"` (overridable),
  `pollIntervalMs = 30_000`, `requestTimeoutMs = 5_000`, `logger` = a silent no-op (SDK writes
  nothing to stdout uninvited).
- **Ruleset transport** `fetchRuleset(config, etag?)`: a conditional `GET <baseUrl>/sdk/v1/ruleset`
  with `Authorization: Bearer <sdkKey>` and, when `etag` is given, `If-None-Match: <etag>`. Returns a
  discriminated result: `{ status: 200, ruleset: Ruleset, etag: string }` | `{ status: 304 }`.
  Aborts the request after `requestTimeoutMs` via `AbortController` (a timeout is a fetch error).
- **`RulesetCache`**: an in-memory holder of the current `Ruleset` (+ its `version` and `etag`) with a
  **forward-only atomic swap** — `set(next)` replaces the cached ruleset only when `next.version` is
  strictly greater, and `get()` returns the whole ruleset reference (never a partial).

## Why

Fulfils **sdk-bootstrap-cache AC4** (config surface + silent logger) and provides the transport used by
bootstrap (AC1/AC8) and the cache's forward-only guarantee used by polling (**sdk-polling-refresh
AC4/AC5**). Keeps HTTP + caching in one place so bootstrap/polling/resilience share one code path.

## How

- Node 18+ globals: use the global `fetch` and `AbortController` — no HTTP library dependency.
- Transport talks to the **unprefixed** `/sdk/v1/ruleset` route shipped in `ruleset-fetch-endpoint`
  (ETag = `"<version>"`, `304` on `If-None-Match` match, `401 BLIND_BAT` on a bad key). Parse the JSON
  body as `Ruleset` from `@togglr/shared-types`; surface the response `ETag` header back to the caller
  so the cache can echo it as the next `If-None-Match`.
- Add a lightweight **schema-version guard**: if `ruleset.schemaVersion` is greater than the SDK's
  supported version, treat the payload as unparseable (throw a typed error) so bootstrap/resilience can
  decide to stay not-ready / hold last-known (feeds bootstrap AC7, resilience AC7). Do NOT swap it in.
- `RulesetCache.set` compares versions; equal/older payloads are ignored (forward-only). Keep `get()`
  returning the current reference so a concurrent reader never sees a half-updated ruleset.
- Dev tooling: add `vitest` (dev) + `"test": "vitest run"` script + a `vitest.config.ts` mirroring
  `packages/eval-core/vitest.config.ts` (`environment: "node"`). `packages/sdk` already deps
  `@togglr/shared-types` + `@togglr/eval-core` (`workspace:*`).

## Verification

- Unit (mock global `fetch` via `vi.stubGlobal`): `fetchRuleset` sends `Authorization: Bearer` and
  (when given) `If-None-Match`; maps a `200` to `{ status: 200, ruleset, etag }` and a `304` to
  `{ status: 304 }`; a slow response aborts after `requestTimeoutMs` and surfaces as an error; a `401`
  surfaces as an error.
- Unit: `RulesetCache` swaps in a strictly-newer version, ignores equal/older, and a
  greater-`schemaVersion` payload is rejected (never cached).
- `pnpm --filter @togglr/sdk typecheck && pnpm --filter @togglr/sdk test` green.

## Notes

- Types: `Ruleset`/`FlagConfig`/`Variation` in `packages/shared-types/src/index.ts:15-28`.
- The endpoint contract lives in `apps/api/src/sdk/ruleset.controller.ts` (Bearer + ETag/304) and is
  already shipped + integration-tested.
- Keep transport + cache pure of timers — the polling loop (separate task) owns scheduling.
