---
title: SessionGuard + CsrfGuard + exempt decorators (global)
status: done
owner: hapham
date: 2026-07-30
parent: tasks/stories/auth-session-bootstrap-csrf.md
sequence: 1
---

# SessionGuard + CsrfGuard + exempt decorators (global)

## What

Global `SessionGuard` (cookie → Redis session → attach user; `401 SLEEPY_OWL` when
missing/expired) and `CsrfGuard` (on mutating verbs, compare `X-CSRF-Token` to the session's
stored `csrfToken`; `403 GRUMPY_OWL` on missing/mismatch), plus `@Public()` and
`@CsrfExempt()` decorators for bootstrap routes.

## Why

Fulfills auth-session-bootstrap-csrf AC2–AC7; enforces protection for logout/logout-all/me and
every future control-plane mutation. cp:110-112,132-134.

## How

- `apps/api/src/auth/guards/session.guard.ts`: read `togglr_session` cookie →
  `SessionService.read(token)`; null → `401 SLEEPY_OWL` (AC4); attach `request.user`, token,
  and `csrfToken`; idle-TTL refresh happens in `SessionService.read`. Skip when `@Public()`.
- `apps/api/src/auth/guards/csrf.guard.ts`: only for `POST/PATCH/PUT/DELETE` (AC5); compare the
  `X-CSRF-Token` header to the session `csrfToken` (AC6) → missing/mismatch = `403 GRUMPY_OWL`.
  Skip when `@CsrfExempt()`. `GET` never requires it.
- Decorators via `SetMetadata`. Register both globally as `APP_GUARD`, Session before Csrf.
- Exempt set is **exactly** `{signup, login, new-account invite-accept}` (AC3/AC7); the
  existing-account invite-accept path is **not** exempt.
- OrgContextGuard / TransactionRunner are out of scope (Org epic) — auth routes are bootstrap
  (no org context).

## Verification

Integration: `GET /auth/me` without a cookie → `401 SLEEPY_OWL` (AC4); a mutation without/with
a mismatched `X-CSRF-Token` → `403 GRUMPY_OWL` (AC2/AC6); a `GET` never requires CSRF (AC5);
bootstrap POSTs accepted without session/CSRF (AC3); existing-account invite-accept without a
session → `401` (AC7). Unit: verb gating + exempt-metadata handling.

## Notes

Depends on the session-store module. Provides `request.user` (the auth context) that the
protected endpoints read.
