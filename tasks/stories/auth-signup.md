---
title: Sign up for a togglr account
status: approved
owner: hapham
date: 2026-07-30
parent: tasks/epics/auth-sessions.md
size: M
---

# Sign up for a togglr account

## Story

As a new user, I want to sign up with email and password, so that I have an account to administer flags.

## Acceptance Criteria

### AC1: Success
- **Given** a unique email and a ≥10-char password
- **When** `POST /auth/signup`
- **Then** it returns `201`, sets the `togglr_session` cookie (`httpOnly; Secure; SameSite=Lax`), and returns `{user, csrfToken}`.

### AC2: Duplicate
- **Given** an email already registered
- **When** signup is attempted
- **Then** `409 GREEDY_FOX`.

### AC3: Weak password
- **Given** a password under 10 chars
- **When** signup is attempted
- **Then** `400 CLUMSY_OWL`.

## Detailed Acceptance Criteria

(Added by BA — edge cases and detailed scenarios)

### AC4: Case-insensitive email uniqueness
- **Given** an email already registered as `Ada@Example.com`
- **When** `POST /auth/signup` is sent with `ada@example.com` (differing only in case)
- **Then** the email is lowercased before the uniqueness check and the request returns `409 GREEDY_FOX`. [api:121; cp:66]

### AC5: Password length boundary
- **Given** a signup request
- **When** the password is exactly 10 characters
- **Then** it is accepted (`201`); a 9-character password returns `400 CLUMSY_OWL`. [api:122]

### AC6: Missing required fields
- **Given** a signup request missing `email` or `password`
- **When** `POST /auth/signup` is sent
- **Then** `400 CLUMSY_OWL`; `name` is optional and its absence does not cause an error. [api:119-123]

### AC7: Password hashing
- **Given** a successful signup
- **When** the user row is persisted
- **Then** the password is stored as an argon2id hash (never plaintext or reversible) and the response body never includes the hash. [cp:126,211]

### AC8: Cookie carries no token in body
- **Given** a successful signup
- **When** the `201` response is returned
- **Then** the `Set-Cookie` header carries `togglr_session` with `httpOnly; Secure; SameSite=Lax` and the session token appears only in the cookie, never in the JSON body. [api:31-38]

### AC9: CSRF-exempt bootstrap
- **Given** a client with no existing session and no `X-CSRF-Token` header
- **When** `POST /auth/signup` is sent
- **Then** the request is accepted (signup is a CSRF-exempt bootstrap POST). [api:35-37]

### AC10: Datastore unavailable
- **Given** Postgres or Redis is unavailable
- **When** `POST /auth/signup` is sent
- **Then** `503 DIZZY_OWL`. [cp:199-200]

## Notes

Password hashed argon2id; no org created; email verification deferred (contract). Depends on Foundation.

## Open Questions

