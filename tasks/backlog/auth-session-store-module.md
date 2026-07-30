---
title: Session store module (Redis tokens, TTLs, cookie helpers)
status: draft
owner: hapham
date: 2026-07-30
parent: tasks/stories/auth-login-logout.md
sequence: 1
---

# Session store module (Redis tokens, TTLs, cookie helpers)

## What

`SessionService` + Redis session store: mint opaque tokens, persist
`session:<token> → {userId, csrfToken, createdAt, lastSeenAt}` with a **30-min idle TTL** and
a **12-h absolute cap**, track the `user_sessions:<userId>` set, validate/refresh/delete/
delete-all, prune dead set members, and provide cookie set/clear helpers. TTLs and cookie
flags are config-driven.

## Why

The session mechanism underpinning login, logout, `/auth/me`, revocation, and the guards.
cp:128-139. Directly backs login AC7 and revocation AC3/AC4/AC6.

## How

- `apps/api/src/auth/session.service.ts`:
  - `create(userId)`: mint a 256-bit random token (`crypto.randomBytes(32)`, base64url) + a
    separate 256-bit `csrfToken`; `SET session:<token>` (JSON) `EX` = idle TTL; `SADD
    user_sessions:<userId> <token>`. Returns `{ token, csrfToken }`.
  - `read(token)`: `GET`; absent → null (expired/revoked). Enforce absolute cap
    (`now - createdAt > 12h` → delete + expired). On valid read, refresh idle TTL (`EXPIRE`)
    and `lastSeenAt` (AC3).
  - `destroy(token)`: `DEL` key + `SREM` from the user set.
  - `destroyAll(userId)`: read set → `DEL` each key → `DEL` the set.
  - Pruning (AC6): when reading the set, drop members whose `session:<token>` no longer exists.
- Config (env.schema + AppConfigService, optional with defaults): `SESSION_IDLE_TTL_S`=1800,
  `SESSION_ABSOLUTE_TTL_S`=43200, `COOKIE_SECURE`=true, cookie name `togglr_session`.
- Cookie helpers: build `Set-Cookie` (`httpOnly; Secure` per config; `SameSite=Lax; Path=/`,
  Max-Age tied to idle TTL) and a clear-cookie. Uses the Foundation `REDIS` (ioredis) client.

## Verification

Integration (real Redis): create→read refreshes idle TTL + `lastSeenAt`; read after idle
expiry → null; absolute cap (seed `createdAt` 12h+ ago) → expired; `destroy` removes key + set
member; `destroyAll` denies all; pruning drops dead set members; Redis down surfaces an error
the caller maps to `503`.

## Notes

**Cookie `Secure` gotcha:** the dev SPA runs over `http://localhost` via the Vite proxy; a
`Secure` cookie is only stored on `localhost` (Chrome treats it as a secure context). The
`COOKIE_SECURE` toggle (default true) lets dev/e2e set false if needed. Tokens are opaque
random — no JWT/signing. Depends on the Foundation Redis client.
