---
title: POST /auth/signup endpoint
status: done
owner: hapham
date: 2026-07-30
parent: tasks/stories/auth-signup.md
sequence: 3
---

# POST /auth/signup endpoint

## What

`POST /auth/signup` — create a user (argon2id-hashed password), start a session, return
`201 { user, csrfToken }`, and set the `togglr_session` cookie.

## Why

Fulfills auth-signup AC1–AC10.

## How

- New `AuthModule` (controller + service) under `apps/api/src/auth/`.
- Request DTO (class-validator): `email` required, `password` required min 10 (AC5), `name`
  optional (AC6). Missing/invalid → `400 CLUMSY_OWL` via the global ValidationPipe + filter.
- Service: lowercase `email` (AC4); uniqueness check → exists ⇒ `409 GREEDY_FOX` (AC2/AC4);
  hash with **argon2id** (AC7 — add the `argon2` dependency; bcrypt fallback per cp:127);
  insert `users` row via Kysely. Never store plaintext; never return the hash (AC7).
- Start a session via `SessionService` (auth-session-store task): set `togglr_session`
  (`httpOnly; Secure; SameSite=Lax`) cookie; body is `{ user:{id,email,name}, csrfToken }`
  only — token lives in the cookie, never the body (AC8).
- Mark the route `@Public()` + `@CsrfExempt()` (guards task) — CSRF-exempt bootstrap (AC9).
- Postgres/Redis unavailable → `503 DIZZY_OWL` (AC10).

## Verification

Integration (real PG + Redis): success → `201`, sets cookie, `{user,csrfToken}` with no hash
(AC1/AC7/AC8); duplicate incl. differing case → `409 GREEDY_FOX` (AC2/AC4); 9-char pw → `400`,
10-char → `201` (AC5); missing email/password → `400`, missing name OK (AC6); no
`X-CSRF-Token` still accepted (AC9). Unit: argon2id hash→verify round-trip.

## Notes

Depends on: users migration (seq1), error envelope (seq2), and the session-store module
(auth-login-logout seq1) for cookie/session mint. Signup does not return `memberships`
(login/me only).
