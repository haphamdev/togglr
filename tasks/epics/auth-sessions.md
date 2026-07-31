---
title: Auth & Sessions
status: done
owner: hapham
date: 2026-07-28
parent: docs/specs/togglr-platform.md
---

# Auth & Sessions

## Business Value

The front door and the guard for the admin surface. Users create accounts, sign in, and
hold secure browser sessions that gate every management action. Because a stolen admin
session can toggle production flags across an org, the session mechanism is a security-
critical foundation: httpOnly + Secure + SameSite cookies (no token in JS-reachable
storage), server-side sessions in Redis for **instant revocation**, and CSRF protection
on mutations. Nothing in the dashboard is safe to build until this holds.

## Scope

### Included

- Account sign-up and login (credential-based).
- Browser sessions: httpOnly + Secure + SameSite session cookies, server-side sessions
  stored in Redis.
- CSRF-token protection on all mutating requests.
- Session lifecycle: idle timeout, logout, instant server-side revocation (one session
  or all of a user's sessions).
- Accept-invite → account creation/linking hook (the auth side of the invite flow owned
  by Org Workspace & Isolation).

### Excluded

- Org/project/environment hierarchy, roles, membership, SDK keys (Org Workspace &
  Isolation epic).
- SSO / external identity providers (later phase).
- Fine-grained permissions (later phase).
- Password-reset email infra beyond what invite/verification reuse (revisit if needed).

## Dependencies

- **Platform Foundation** — monorepo, shared-types, base API + web shell.
- Infrastructure: a togglr-owned Redis instance (session store).
- Downstream: Org Workspace & Isolation and every management action depend on an
  authenticated session.

## Acceptance Criteria (Epic-Level)

- A user can sign up, log in, and receive an httpOnly/Secure/SameSite session cookie
  backed by a Redis session; the token is never exposed to JavaScript.
- Mutating requests without a valid CSRF token are rejected.
- Logging out and admin-triggered revocation invalidate the session server-side
  immediately (subsequent requests are denied).
- Sessions expire after a defined idle timeout.

## Stories

- [x] [Sign up for a togglr account](../stories/auth-signup.md) — M — **done**
- [x] [Log in and log out](../stories/auth-login-logout.md) — M — **done**
- [x] [Session bootstrap & CSRF protection](../stories/auth-session-bootstrap-csrf.md) — M — **done**
- [x] [Instant session revocation & idle timeout](../stories/auth-revocation-idle-timeout.md) — M — **done**
- [ ] [Invite-accept account creation/linking](../stories/auth-invite-accept-hook.md) — M — **⛔ BLOCKED / deferred** to the [Org Workspace & Isolation](./org-workspace-isolation.md) epic (needs the `invites`/`memberships` tables + token validation). Plan after those land.

> **Epic status:** core auth & sessions delivered and verified (4/5 stories). The 5th
> story is externally blocked on Org Workspace and will be planned there; it is not part
> of this epic's shippable scope.

## Open Questions

- [ ] Email verification on sign-up required for MVP, or defer?
- [ ] Password policy / hashing choice (design-doc detail).
- [ ] Idle-timeout and absolute-session-lifetime durations.
