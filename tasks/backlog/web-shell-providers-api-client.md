---
title: Wire TanStack Query, typed API client with CSRF, and no-op SSE placeholder
status: done
owner: hapham
date: 2026-07-30
parent: tasks/stories/foundation-web-shell.md
sequence: 2
---

# Wire TanStack Query, typed API client with CSRF, and no-op SSE placeholder

## What

Add the data layer to `apps/web`: a TanStack Query `QueryClientProvider` wrapping the app,
a typed API-client stub for `/api/v1`, and a no-op SSE-client placeholder. The API client
attaches the `X-CSRF-Token` header on every mutating request (POST/PATCH/PUT/DELETE) using
the token obtained from `GET /auth/me`, and never reads the httpOnly session cookie. The SSE
placeholder opens no connection in Phase 1.

## Why

Fulfills foundation-web-shell AC3 (TanStack Query provider, typed API-client stub, Tailwind +
shadcn/ui, and a no-op SSE-client placeholder present) and AC5 (mutating requests attach
`X-CSRF-Token` from `GET /auth/me`; the client never reads the httpOnly session cookie).
Provides the client the seq-3 auth bootstrap consumes.

## How

- **TanStack Query provider:** create a shared `QueryClient` (`src/app/query-client.ts`) and
  wrap the router tree in `<QueryClientProvider>` in `src/main.tsx` (or the root layout).
  Sensible defaults (e.g. no refetch-on-focus storm); leave devtools optional.
- **Typed API client** (`src/api/client.ts`): a `fetch` wrapper targeting the `/api/v1`
  base URL (`docs/api/togglr-api.md:30`). Always send `credentials: "include"` so the
  browser attaches the `httpOnly; Secure; SameSite=Lax` `togglr_session` cookie — the client
  code MUST NOT read `document.cookie` for the session (it is not JS-readable;
  `docs/api/togglr-api.md:31-38`).
- **CSRF handling:** hold the per-session `csrfToken` (sourced from `GET /auth/me`, see
  `docs/api/togglr-api.md:34,193`) in a small in-memory store/context. On any mutating verb
  (`POST`/`PATCH`/`PUT`/`DELETE`) the client sets the `X-CSRF-Token` header from that store;
  GET requests send no CSRF header (`docs/api/togglr-api.md:32-34`). Expose a setter so the
  seq-3 bootstrap can populate the token after `/auth/me` resolves. JSON is camelCase both
  ways (`docs/api/togglr-api.md:49`); parse the standard error envelope
  `{ error: { code, message } }` (`:52-53`) into a typed error carrying `code`.
- **No-op SSE placeholder** (`src/api/sse-client.ts`): export a client with `connect()`/
  `close()` that are inert in Phase 1 — `connect()` does not open an `EventSource` or any
  network connection (Phase-2 seam per story Notes). Include a guard/flag so it is provably
  dormant.
- Keep types in/aligned with `packages/shared-types` DTOs where they exist; stub request/
  response types inline only where a DTO is not yet defined.

## Verification

- Manual: with the app running, a mutating call through the client sends `X-CSRF-Token` and
  `credentials: include` (inspect network); a GET omits `X-CSRF-Token`; instantiating the SSE
  client and calling `connect()` opens no network connection (no `EventSource` in devtools).
- Tests to write (unit/integration, mocked `fetch`): (1) a `POST` (and one other mutating
  verb) attaches `X-CSRF-Token` equal to the stored token and sets `credentials: "include"`;
  (2) a `GET` sends no `X-CSRF-Token`; (3) the client never references `document.cookie`
  (assert via a spy that `document.cookie` getter is not read during a request); (4) the SSE
  placeholder's `connect()` does not construct `EventSource`/`fetch` (spy asserts zero calls).
  Medium granularity — one API-client test module + one SSE-placeholder test.

## Notes

- Depends on `web-shell-spa-scaffold` (seq 1) for the app/router to wrap.
- The CSRF token store is populated by `web-shell-auth-routing` (seq 3) after `/auth/me`;
  expose the setter/context now so seq 3 wires it without refactoring the client.
- Exempt bootstrap POSTs (signup/login/new-account invite-accept) are CSRF-exempt
  (`docs/api/togglr-api.md:35-37`) — the client may still call them; they simply carry no
  CSRF token because none exists pre-session.
