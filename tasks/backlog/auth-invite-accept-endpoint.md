---
title: POST /auth/invites/:token/accept (auth side)
status: done
owner: hapham
date: 2026-07-30
parent: tasks/stories/auth-invite-accept-hook.md
sequence: 1
---

# POST /auth/invites/:token/accept (auth side)

## What

`POST /auth/invites/:token/accept` — the **auth-owned half**: create a new user + start a
session (`201`) when no account exists, or link a membership to the authenticated existing
user (`200`); enforce SHY_FOX / PUZZLED_FOX and the CSRF split.

## Why

Fulfills auth-invite-accept-hook AC1–AC7.

## How

Two paths (api:227-259):
- **(a) no account for the invited email** → `password` required (missing → `400 SHY_FOX`,
  AC2); create the user (argon2id, lowercased email), start a session, add the membership →
  `201` (AC1/AC7). CSRF-exempt bootstrap (AC6).
- **(b) account exists** → requires a session whose user email = the invited email (mismatch →
  `403 PUZZLED_FOX`, AC3; no session → `401 SLEEPY_OWL`, AC6); add the membership to the
  existing user → `200` (AC4/AC7). **Not** CSRF-exempt.
- Invite-token states → `404 LOST_BEE` / `410 TIRED_BEE` / `409 HAPPY_BEE` (AC5).
- **Seam:** invite-token validation (invites table, `token_hash` lookup, status/expiry) and the
  membership insert are owned by **Org Workspace & Isolation** (`org-invite-teammates`). This
  task implements only account-create/link + session + status-code logic, consuming an
  interface: `invites.lookupByToken(token) → {orgId,email,role,status,expiresAt}`,
  `invites.consume(id)`, and `memberships.add(userId,orgId,role)`.

## Verification

Integration (once the Org invite infra — or a test double of the interface — exists):
new-account accept → `201` + session (AC1); no password → `400 SHY_FOX` (AC2); existing account
with a matching session → `200` link (AC4/AC7); mismatched session → `403 PUZZLED_FOX` (AC3);
no session on the existing path → `401` (AC6); unknown/expired/consumed token →
`404`/`410`/`409` (AC5); new-account path CSRF-exempt, existing path not (AC6).

## Notes

**BLOCKED / SEAM** — depends on Org `org-invite-teammates` (invites table + token validation +
membership insert) plus `auth-signup`/session-store. Recommend sequencing this task **after**
the Org invite infrastructure lands, or building against the defined interface + a test double
now and integrating later. This is the one Auth task that cannot be fully completed within the
Auth epic in isolation.
