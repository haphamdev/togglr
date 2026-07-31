---
title: GET /auth/me endpoint
status: done
owner: hapham
date: 2026-07-30
parent: tasks/stories/auth-session-bootstrap-csrf.md
sequence: 2
---

# GET /auth/me endpoint

## What

`GET /auth/me` → `200 { user, memberships, csrfToken }` for a valid session; `401 SLEEPY_OWL`
without one.

## Why

Fulfills auth-session-bootstrap-csrf AC1/AC4; the SPA session-bootstrap call the web shell
already makes.

## How

- `AuthController` `@Get('me')`, protected by the global `SessionGuard` (a `GET`, so CSRF is
  not required). Read `request.user` + session `csrfToken` (set by the guard); load the user
  `{id,email,name}`; return `{ user, memberships, csrfToken }`.
- No session → the `SessionGuard` already yields `401 SLEEPY_OWL` (AC4).

## Verification

Integration: with a valid session cookie → `200` with `{user,memberships,csrfToken}`; without
a cookie → `401 SLEEPY_OWL`. Confirms the web shell's `/auth/me` bootstrap now succeeds and the
`401 → /login` redirect path works when unauthenticated.

## Notes

**memberships seam:** returns `[]` until Org Workspace ships the memberships table/query (same
seam as login). Depends on the guards (seq1) + session-store.
