---
title: Invite teammates by email
status: done
owner: hapham
date: 2026-07-30
parent: tasks/epics/org-workspace-isolation.md
size: L
---

# Invite teammates by email

## Story

As an org admin, I want to invite teammates by email with a role, so that they can join the org.

## Acceptance Criteria

### AC1: Invite
- **Given** admin rights
- **When** `POST …/invites {email, role}`
- **Then** `201` with a pending invite (`expiresAt` ~7 days) and an email link (Mailhog in dev).

### AC2: Duplicates
- **Given** the email already belongs to the org, or a pending invite already exists
- **When** `POST …/invites` is sent
- **Then** an already-member email → `409 COZY_BEE` and an existing pending invite → `409 BUSY_BEE`.

### AC3: Preview
- **Given** a token
- **When** `GET /auth/invites/:token`
- **Then** it returns org/role/`userExists`/`expiresAt`; expired → `410 TIRED_BEE`; consumed → `409 HAPPY_BEE`; unknown → `404 LOST_BEE`.

### AC4: Accept → membership
- **Given** a valid accept
- **When** it is processed
- **Then** the membership is created with the invited role (account creation/linking via `auth-invite-accept-hook`). List/resend/revoke: `GET …/invites`, `POST …/invites/:inviteId/resend` (`409 HAPPY_BEE` if consumed), `DELETE …/invites/:inviteId`.

## Detailed Acceptance Criteria

(Added by BA — edge cases and detailed scenarios)

### AC5: Admin-gated invite creation
- **Given** an authenticated user
- **When** `POST …/invites` is called
- **Then** a `member` gets `403 SNEAKY_OWL` and a non-member gets `403 LONELY_OWL`; only `admin`+ may invite.

### AC6: Invalid invite body
- **Given** an admin
- **When** `POST …/invites` sends a malformed email or a role outside `owner|admin|member`
- **Then** `400 CLUMSY_OWL`.

### AC7: Resend regenerates and resets expiry
- **Given** a pending invite
- **When** `POST …/invites/:inviteId/resend` is called
- **Then** a fresh token is generated (invalidating the old one) and `expiresAt` is reset; a consumed invite → `409 HAPPY_BEE` and an unknown `:inviteId` → `404 LOST_OWL`.

### AC8: Revoke pending invite
- **Given** a pending invite
- **When** `DELETE …/invites/:inviteId` is called
- **Then** `204` and the invite can no longer be accepted; an unknown `:inviteId` → `404 LOST_OWL`.

### AC9: Token hashed at rest
- **Given** an invite is created
- **When** the `invites` row is stored
- **Then** only `token_hash` is persisted — the plaintext token appears only in the emailed link, never in the database.

### AC10: Status lifecycle
- **Given** an invite
- **When** it is accepted or its `expiresAt` passes
- **Then** its `status` transitions `pending → accepted` on accept, or `pending → expired` once past `expiresAt`.

## Notes

**Seam** — owns invite token lifecycle + membership insert; account/session on accept owned by `auth-invite-accept-hook`. Depends on `org-members-roles`, Auth.

## Open Questions

- [x] Invite expiry duration and resend/pending semantics → expiry is ~7 days (`expiresAt = created + 7d`, per the api:398 example); resend regenerates the token (invalidating the old) and resets expiry (api:417; cp:154).
