---
title: Web login/signup forms + logout wiring
status: draft
owner: hapham
date: 2026-07-30
parent: tasks/stories/auth-login-logout.md
sequence: 3
---

# Web login/signup forms + logout wiring

## What

Replace the disabled `/login` skeleton with a working login form (plus a signup form) that
call the API, and add a logout action in the app shell — completing the end-to-end
user-facing auth flow.

## Why

The story persona ("As a Flag Administrator, I want to log in and log out") requires a UI.
Foundation's web-shell already built the CSRF-aware `apiFetch`, `csrf-store`, `AuthProvider`/
`useAuthMe`, and the `/login` skeleton — this wires them to the real endpoints.

## How

- `apps/web/src/routes/login.tsx`: controlled email+password form → `apiFetch('/auth/login',
  {method:'POST', body})`. On success: `setCsrfToken(res.csrfToken)` and invalidate the
  `['auth','me']` query so `AuthProvider` transitions to `authenticated` and the router lands
  on `/`. On `401 SLY_FOX`: generic error message. On `400 CLUMSY_OWL`: field validation.
- Signup form/route → `POST /auth/signup`, same success handling.
- Logout: a control in `RootLayout` nav → `apiFetch('/auth/logout',{method:'POST'})`; on
  success clear the CSRF token, invalidate `['auth','me']`, redirect to `/login`.
- Reuse the vendored shadcn `Button` + `auth-context`; introduce no new data-layer pattern.

## Verification

RTL: submitting valid creds calls `apiFetch` with the body and invalidates `auth-me`; a `401`
renders the generic error; logout posts and clears session state. Manual smoke (`pnpm dev`):
sign up → land authenticated on `/`; refresh persists (cookie); logout → back to `/login`.

## Notes

Depends on the login/logout + `/auth/me` endpoints. This is the task that makes the app
testable end-to-end (previously `/auth/me` 404'd). Preserve the httpOnly invariant — never
read `document.cookie`.
