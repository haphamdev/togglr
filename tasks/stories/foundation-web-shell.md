---
title: Web app shell (React SPA)
status: approved
owner: hapham
date: 2026-07-30
parent: tasks/epics/platform-foundation.md
size: M
---

# Web app shell (React SPA)

## Story

As a developer, I want the React SPA shell with routing, data-fetching, and styling wired, so that admin screens plug into a consistent app.

## Acceptance Criteria

### AC1: Renders
- **Given** `pnpm dev` for web
- **When** the app loads
- **Then** the Vite + React Router SPA renders the app layout and navigation.

### AC2: Auth-aware routing
- **Given** no session
- **When** a protected route is visited
- **Then** the router redirects to the login route (skeleton).

### AC3: Providers wired
- **Given** the shell
- **When** it starts
- **Then** TanStack Query provider, a typed API-client stub, Tailwind + shadcn/ui, and a no-op SSE-client placeholder are present.

## Detailed Acceptance Criteria

(Added by BA — edge cases and detailed scenarios)

### AC4: Session bootstrap on load
- **Given** the SPA loads
- **When** it calls `GET /auth/me`
- **Then** a `401 SLEEPY_OWL` redirects to the login route and a `200` renders the authenticated shell using the returned user/memberships. [api:182-201]

### AC5: CSRF wiring in the API client
- **Given** the typed API client
- **When** it issues a mutating request (POST/PATCH/PUT/DELETE)
- **Then** it attaches the `X-CSRF-Token` header (token from `GET /auth/me`) and never reads the httpOnly session cookie. [api:31-38]

### AC6: Async loading and error states
- **Given** a TanStack Query data fetch
- **When** it is loading or errors
- **Then** the shell renders explicit loading and error states (never a blank screen), and the SSE placeholder opens no connection in Phase 1.

## Notes

SSE placeholder stays no-op until Phase 2. Depends on `foundation-scaffold-monorepo`.

## Open Questions

