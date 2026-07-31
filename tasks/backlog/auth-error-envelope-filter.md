---
title: Standard error envelope + global exception filter
status: done
owner: hapham
date: 2026-07-30
parent: tasks/stories/auth-signup.md
sequence: 2
---

# Standard error envelope + global exception filter

## What

Introduce the control-plane error envelope `{ "error": { "code", "message" } }` (api:52-53)
for every non-2xx response, via a global NestJS exception filter plus a `DomainException`
base carrying an animal `code` + HTTP status. Add a global `ValidationPipe` so malformed
bodies become `400 CLUMSY_OWL`.

## Why

Every auth AC returns an animal-coded error in this envelope (GREEDY_FOX, SLY_FOX,
GRUMPY_OWL, SHY_FOX, PUZZLED_FOX, LOST_BEE, TIRED_BEE, HAPPY_BEE, DIZZY_OWL, CLUMSY_OWL).
Foundation shipped none of this — it is a hard prerequisite for every endpoint in this epic
and all later control-plane epics. cp:120-121; error-codes.md.

## How

- `apps/api/src/common/domain-exception.ts` — `DomainException extends Error` with
  `{ code: string; status: HttpStatus }`; animal codes (error-codes.md) are the source of truth.
- `apps/api/src/common/all-exceptions.filter.ts` — `@Catch()` filter:
  - `DomainException` → `{ error: { code, message } }` at its `status`.
  - Nest validation / `BadRequestException` → `400 { error: { code: "CLUMSY_OWL", message } }`.
  - Caught infra failure (Postgres/Redis) → `503 DIZZY_OWL` — prefer services throwing a
    `DizzyOwl` `DomainException` on caught connection errors over filter-level error sniffing
    (document the chosen approach).
  - Unknown → `500` with a generic opaque envelope; never leak internals (cp:120-121).
- Register globally (`APP_FILTER` in AppModule, or `useGlobalFilters`/`useGlobalPipes` in
  `main.ts`). `ValidationPipe` with `whitelist` + `forbidNonWhitelisted`.
- **Leave `/healthz` intact:** it returns the degraded health shape `{status,checks}` (not the
  envelope). Ensure the filter does not rewrite the HealthController's 503 body.

## Verification

Unit: filter maps a `DomainException` → correct envelope + status; a validation error → `400
CLUMSY_OWL`; an unknown error → `500` opaque (no internals). Integration: a route throwing a
`DomainException` returns the JSON envelope; `/healthz` still returns `{status,checks}`
unchanged.

## Notes

Cross-cutting; lives in `common/`. Unblocks all subsequent auth endpoints. Parented to
auth-signup as the first consumer, but shared across the epic.
