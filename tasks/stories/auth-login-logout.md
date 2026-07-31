---
title: Log in and log out
status: done
owner: hapham
date: 2026-07-30
parent: tasks/epics/auth-sessions.md
size: M
---

# Log in and log out

## Story

As a Flag Administrator, I want to log in and log out, so that I can start and end an authenticated session.

## Acceptance Criteria

### AC1: Login
- **Given** valid credentials
- **When** `POST /auth/login`
- **Then** `200` sets `togglr_session` and returns `{user, memberships, csrfToken}`.

### AC2: Bad creds
- **Given** a wrong email/password
- **When** login is attempted
- **Then** `401 SLY_FOX` (generic, no user enumeration).

### AC3: Logout
- **Given** a session
- **When** `POST /auth/logout`
- **Then** `204`, the Redis session key is deleted, and a subsequent authed request → `401 SLEEPY_OWL`.

## Detailed Acceptance Criteria

(Added by BA — edge cases and detailed scenarios)

### AC4: Missing credential fields
- **Given** a login request missing `email` or `password`
- **When** `POST /auth/login` is sent
- **Then** `400 CLUMSY_OWL`. [api:73]

### AC5: No user enumeration
- **Given** an unknown email versus a known email with a wrong password
- **When** login is attempted for each
- **Then** both return an identical `401 SLY_FOX` response — the two cases are indistinguishable to the caller. [api:167]

### AC6: Logout is a protected mutation
- **Given** an authenticated session
- **When** `POST /auth/logout` is sent without an `X-CSRF-Token` header
- **Then** `403 GRUMPY_OWL`; when sent with no session at all → `401 SLEEPY_OWL` (login itself remains CSRF-exempt bootstrap). [api:32-38]

### AC7: Session record written on login
- **Given** valid credentials
- **When** `POST /auth/login` succeeds
- **Then** a Redis record `session:<token> → {userId, csrfToken, createdAt, lastSeenAt}` is written and `<token>` is added to the `user_sessions:<userId>` set. [cp:129-138]

### AC8: Redis unavailable at login
- **Given** Redis is unavailable
- **When** `POST /auth/login` is sent
- **Then** `503 DIZZY_OWL`. [cp:199]

## Notes

Depends on Foundation (Redis session store).

## Open Questions

