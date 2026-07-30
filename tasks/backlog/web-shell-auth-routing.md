---
title: Session bootstrap, auth-aware routing, and async loading/error states
status: done
owner: hapham
date: 2026-07-30
parent: tasks/stories/foundation-web-shell.md
sequence: 3
---

# Session bootstrap, auth-aware routing, and async loading/error states

## What

On app load, bootstrap the session by calling `GET /auth/me` through the typed API client:
a `401 SLEEPY_OWL` redirects to the login route; a `200` renders the authenticated shell
using the returned `user` + `memberships` and populates the CSRF token. Protected routes
redirect to login when there is no session. Every data-fetch renders explicit loading and
error states (never a blank screen), and the SSE placeholder opens no connection.

## Why

Fulfills foundation-web-shell AC2 (no session → protected route redirects to the login
skeleton), AC4 (`GET /auth/me`: `401 SLEEPY_OWL` → login redirect, `200` → authed shell from
returned user/memberships; `docs/api/togglr-api.md:182-201`), and AC6 (TanStack Query
loading/error states render explicitly; SSE placeholder opens no connection in Phase 1).

## How

- **Bootstrap query:** a `useAuthMe` TanStack Query hook calling the seq-2 client's
  `GET /auth/me`. On success (`200`) it yields `{ user, memberships, csrfToken }`
  (`docs/api/togglr-api.md:187-201`); call the seq-2 CSRF setter with `csrfToken` so
  subsequent mutations carry `X-CSRF-Token`.
- **401 handling:** map the `401 SLEEPY_OWL` response
  (`docs/api/error-codes.md:68`, code from the error envelope) to an unauthenticated state.
  A dedicated `RequireAuth` guard/route wrapper (React Router) redirects to the `/login`
  skeleton route when the bootstrap resolves unauthenticated — covering both "no session"
  (AC2) and "session expired/invalid" (AC4). Use a `<Navigate to="/login">`/loader redirect;
  preserve the attempted path for post-login return if trivial.
- **Authed shell render:** on `200`, provide `user`/`memberships` via an auth context so the
  layout (seq 1) shows the user and org switcher; protected routes render their outlet.
- **Async states (AC6):** while the bootstrap (and any protected-route query) is `isLoading`,
  render an explicit loading state (skeleton/spinner) — never blank; on non-401 errors (e.g.
  `503 DIZZY_OWL`, network) render an explicit error state with a retry affordance. Distinguish
  the 401→redirect path from the generic error state.
- **SSE dormant:** confirm the seq-2 SSE placeholder is not connected during or after
  bootstrap (Phase-1 no-op per story Notes).

## Verification

- Manual: with no/invalid session, loading a protected route lands on `/login`; with a valid
  session, the authed shell renders the user + memberships; throttling the network shows the
  loading state, and a failing `/auth/me` (non-401) shows the error state — never a blank page.
- Tests to write (component/integration, RTL + mocked API client):
  (1) `/auth/me` → `401 { error: { code: "SLEEPY_OWL" } }` renders the login route (redirect);
  (2) `/auth/me` → `200` with user+memberships renders the authed shell and sets the CSRF
  token (assert the client's stored token equals the response `csrfToken`);
  (3) visiting a protected route with no session redirects to `/login` (AC2);
  (4) a pending `/auth/me` renders the loading state; a non-401 error renders the error state
  (both assert non-empty DOM — never blank);
  (5) the SSE placeholder opens no connection during bootstrap.
  Medium granularity — one auth-bootstrap/routing integration test module.

## Notes

- Depends on `web-shell-spa-scaffold` (seq 1, layout + `/login` route) and
  `web-shell-providers-api-client` (seq 2, TanStack Query + typed client + CSRF setter + SSE
  placeholder).
- `SLEEPY_OWL` = `401` missing/invalid/expired session on any authed control-plane route
  (`docs/api/error-codes.md:68`); `/auth/me` is session-authed (`docs/api/togglr-api.md:185`).
- Login is a skeleton in Phase 1 (story AC2 "skeleton"); actual credential submission is the
  auth epic's concern — this task only needs the redirect target to exist.
