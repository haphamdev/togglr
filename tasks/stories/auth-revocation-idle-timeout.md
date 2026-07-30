---
title: Instant session revocation & idle timeout
status: approved
owner: hapham
date: 2026-07-30
parent: tasks/epics/auth-sessions.md
size: M
---

# Instant session revocation & idle timeout

## Story

As a Flag Administrator, I want to revoke all my sessions and have idle sessions expire, so that a stolen or stale session cannot toggle production flags.

## Acceptance Criteria

### AC1: Revoke all
- **Given** multiple sessions
- **When** `POST /auth/logout-all`
- **Then** `204` and every prior session for the user is denied on its next request.

### AC2: Idle expiry
- **Given** a session idle past the timeout
- **When** an authed request is made
- **Then** `401 SLEEPY_OWL`.

## Detailed Acceptance Criteria

(Added by BA — edge cases and detailed scenarios)

### AC3: Idle TTL = 30 min
- **Given** a session whose `lastSeenAt` was refreshed on each request
- **When** no request is made for 30 minutes and then an authed request is sent
- **Then** the session has expired via idle TTL and the request returns `401 SLEEPY_OWL`. [cp:129-131,240]

### AC4: Absolute lifetime = 12 h
- **Given** a session kept continuously active
- **When** 12 hours elapse since `createdAt`
- **Then** the absolute-lifetime cap is hit regardless of activity and the next request returns `401 SLEEPY_OWL`. [cp:131,240]

### AC5: logout-all requires CSRF
- **Given** an authenticated session
- **When** `POST /auth/logout-all` is sent without an `X-CSRF-Token` header
- **Then** `403 GRUMPY_OWL` (logout-all is a session-authenticated mutation). [api:32-34]

### AC6: Set hygiene prunes dead tokens
- **Given** a `user_sessions:<userId>` set containing tokens whose `session:<token>` records have already lapsed via idle TTL
- **When** the set is read or a logout occurs
- **Then** the lapsed tokens are pruned so the set never accumulates dead tokens. [cp:136-139]

### AC7: Redis unavailable
- **Given** Redis is unavailable
- **When** an authed request triggers a session lookup
- **Then** the lookup fails and the request returns `503 DIZZY_OWL`. [cp:199; arch:275]

## Notes

Server-side (Redis) sessions give immediate revocation. Depends on `auth-login-logout`.

## Open Questions

- [x] Idle-timeout and absolute-session-lifetime durations → **30 min idle / 12 h absolute**. (cp:240)
