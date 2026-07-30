---
title: Session bootstrap & CSRF protection
status: approved
owner: hapham
date: 2026-07-30
parent: tasks/epics/auth-sessions.md
size: M
---

# Session bootstrap & CSRF protection

## Story

As a Flag Administrator, I want the SPA to bootstrap my session and a CSRF token, so that mutations are protected against cross-site forgery.

## Acceptance Criteria

### AC1: Bootstrap
- **Given** a valid session
- **When** `GET /auth/me`
- **Then** it returns `{user, memberships, csrfToken}`.

### AC2: CSRF enforced
- **Given** a session-authenticated mutation without or with a mismatched `X-CSRF-Token`
- **When** it is sent
- **Then** `403 GRUMPY_OWL`.

### AC3: Bootstrap exemption
- **Given** the bootstrap POSTs (`/auth/signup`, `/auth/login`, new-account `/auth/invites/:token/accept`)
- **When** they are sent without a session/CSRF token
- **Then** they are accepted (CSRF-exempt).

## Detailed Acceptance Criteria

(Added by BA — edge cases and detailed scenarios)

### AC4: /auth/me requires a session
- **Given** a request to `GET /auth/me` carrying no valid session cookie
- **When** it is sent
- **Then** `401 SLEEPY_OWL`. [api:69]

### AC5: CSRF scope is mutating verbs only
- **Given** a session-authenticated request
- **When** it is a `POST`/`PATCH`/`PUT`/`DELETE`
- **Then** an `X-CSRF-Token` header is required; a `GET` (safe read) never requires it. [api:32-34]

### AC6: Token compared to session record
- **Given** a session-authenticated mutation
- **When** the `X-CSRF-Token` value is compared against the `csrfToken` stored in the session record
- **Then** a match passes; a mismatch or a missing header → `403 GRUMPY_OWL`. [cp:133-134]

### AC7: Exempt set is exact
- **Given** the CSRF-exempt bootstrap set is exactly `{signup, login, new-account invite-accept}`
- **When** an existing-account invite-accept (which carries a session) is sent without an `X-CSRF-Token`
- **Then** it is NOT exempt and CSRF enforcement applies (missing token → `403 GRUMPY_OWL`). [api:35-37]

## Notes

Cookie never JS-readable. Depends on `auth-login-logout`.

## Open Questions

