---
title: Gate members-table controls by role in the web dashboard
status: approved
owner: hapham
date: 2026-07-31
parent: tasks/stories/org-members-control-gating-ui.md
sequence: 1
---

# Gate members-table controls by role in the web dashboard

## What

On `apps/web/src/routes/org-members.tsx`, render the per-row role `Select` and
`Remove` button only for owners; non-owners see the role as static text with no
remove control.

## How

- Source the caller's role: `useOrg(slug).org.role` (already fetched elsewhere) or
  `useAuth().memberships` matched on `slug`.
- If `role === "owner"`: keep the current `Select` + `Remove` controls.
  Otherwise: render `member.role` as plain text and omit the `Remove` cell action.
- Leave the invites section untouched (server-gated).

## Acceptance

- As a non-owner the members table is read-only (no `Select`, no `Remove`); as an
  owner the controls remain functional.
- `pnpm --filter @togglr/web typecheck && pnpm --filter @togglr/web test` green;
  add/extend an RTL test covering both the owner and non-owner rendering.

## Notes

UI-only; the API already enforces `403 SNEAKY_OWL`, so this is defense-in-depth
UX, not the security boundary.
