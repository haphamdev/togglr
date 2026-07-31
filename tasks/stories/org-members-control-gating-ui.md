---
title: Gate member management controls by role in the dashboard
status: approved
owner: hapham
date: 2026-07-31
parent: tasks/epics/org-workspace-isolation.md
size: S
---

# Gate member management controls by role in the dashboard

## Story

As an org member who is not an owner, I want the members page to only show me
controls I'm allowed to use, so that I'm not offered actions that always fail.

## Context

`GET …/members` is any-member, but role change / removal are owner-only. The
members table currently renders the role `Select` and the `Remove` button for
everyone; a non-owner clicking them gets a correct `403 SNEAKY_OWL`, but the
control shouldn't have been offered. This is a UX-correctness gap, not a security
gap (the API enforces the rule).

## Acceptance Criteria

### AC1: Owner sees controls
- **Given** an `owner` viewing the members table
- **Then** the per-row role `Select` and `Remove` button are enabled.

### AC2: Non-owner sees read-only
- **Given** an `admin` or `member` viewing the members table
- **Then** each member's role renders as static text (no `Select`) and no `Remove` button is shown.

### AC3: No regression to invites
- **Given** the invites section (admin-gated on the server)
- **Then** its create/list/resend/revoke controls are unchanged.

## Notes

Source the caller's role from `useOrg(slug).org.role` (or `useAuth().memberships`).
UI-only change; no API change. Depends on `org-members-roles`.
