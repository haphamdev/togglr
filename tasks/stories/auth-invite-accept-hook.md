---
title: Invite-accept account creation/linking
status: done
owner: hapham
date: 2026-07-30
parent: tasks/epics/auth-sessions.md
size: M
---

# Invite-accept account creation/linking

## Story

As an invited teammate, I want accepting an invite to create or link my account and start a session, so that I join the org and can sign in.

## Acceptance Criteria

### AC1: New account
- **Given** no account for the invited email
- **When** `POST /auth/invites/:token/accept` with a password
- **Then** it creates the user, starts a session, and returns `201`.

### AC2: Missing password
- **Given** a new-account accept with no password
- **When** it is sent
- **Then** `400 SHY_FOX`.

### AC3: Wrong user
- **Given** an existing account
- **When** the session user's email ≠ the invited email
- **Then** `403 PUZZLED_FOX`.

## Detailed Acceptance Criteria

(Added by BA — edge cases and detailed scenarios)

### AC4: Existing-account linking
- **Given** an authenticated session whose user email matches the invited email
- **When** `POST /auth/invites/:token/accept` is sent
- **Then** the membership is added to the existing user (no new account is created) and the request returns `200`. [api:243-244]

### AC5: Invalid token states
- **Given** an accept request
- **When** the token is unknown/void, past expiry, or already consumed
- **Then** it returns `404 LOST_BEE`, `410 TIRED_BEE`, or `409 HAPPY_BEE` respectively. [api:255-257]

### AC6: CSRF split by account path
- **Given** the two accept paths
- **When** a new-account accept is sent with no session/CSRF, versus an existing-account accept sent with no session
- **Then** the new-account accept is CSRF-exempt and accepted, while the existing-account accept requires a session (not exempt) and returns `401 SLEEPY_OWL` when none is present. [api:35-37]

### AC7: 201 vs 200 status
- **Given** a valid, unconsumed invite token
- **When** a new account is created (session started) versus a membership linked to an existing account
- **Then** the response is `201` for the new-account case and `200` for the existing-account link. [api:243]

## Notes

**Seam** — this story owns account creation/linking + session; invite-token validation and membership insert are owned by Org story `org-invite-teammates`. The endpoint is assembled from both. Depends on `auth-signup` and Org `org-invite-teammates`.

## Open Questions

