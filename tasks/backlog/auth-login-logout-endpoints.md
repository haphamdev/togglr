---
title: POST /auth/login and POST /auth/logout endpoints
status: draft
owner: hapham
date: 2026-07-30
parent: tasks/stories/auth-login-logout.md
sequence: 2
---

# POST /auth/login and POST /auth/logout endpoints

## What

`POST /auth/login` (verify credentials, start a session, return `200 { user, memberships,
csrfToken }`) and `POST /auth/logout` (`204`, delete the session, clear the cookie).

## Why

Fulfills auth-login-logout AC1–AC8.

## How

- **Login:** DTO `email`+`password` (missing → `400 CLUMSY_OWL`, AC4). Lowercase email, load
  user, `argon2.verify`. Mismatch **or** unknown email → identical `401 SLY_FOX` (AC2/AC5):
  same code/message and constant-time-ish (verify against a dummy hash when the user is absent
  to avoid a timing signal). Success → `SessionService.create` → set cookie, write the session
  record (AC7); return `{ user, memberships, csrfToken }`. Redis down → `503 DIZZY_OWL` (AC8).
  `@Public()` + `@CsrfExempt()` (bootstrap).
- **Logout:** protected mutation (SessionGuard + CsrfGuard) — no CSRF → `403 GRUMPY_OWL`, no
  session → `401 SLEEPY_OWL` (AC6). `SessionService.destroy(token)` so a subsequent authed
  request → `401 SLEEPY_OWL` (AC3). Clear the cookie. `204`.

## Verification

Integration: valid login → `200`, sets cookie + body (AC1/AC7); wrong password and unknown
email → **identical** `401 SLY_FOX` (AC2/AC5); missing fields → `400` (AC4); logout with
session+CSRF → `204`, then an authed request → `401` (AC3); logout without CSRF → `403
GRUMPY_OWL`, without a session → `401` (AC6).

## Notes

**memberships seam:** the `memberships` table is owned by Org Workspace & Isolation. Until
that epic lands, login returns `memberships: []`; wire the real query when Org ships. Depends
on session-store (seq1), users migration, guards, and the error filter.
