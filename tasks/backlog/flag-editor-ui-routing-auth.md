---
title: Editor routing + auth-aware read-only for members
status: draft
owner: hapham
date: 2026-08-01
parent: stories/flag-editor-ui.md
sequence: 6
---

# Editor routing + auth-aware read-only

## What

Wire the flags list + editor into the app router under the org/project/environment path, and make the
editor auth-aware: an invalid session redirects to login; a `member` gets a read-only editor.

## Why

Fulfils flag-editor-ui AC11 (401 -> login redirect; a member save would 403 SNEAKY_OWL, so render
read-only for members) and provides the routing the AC1/AC2/AC3 screens need.

## How

- Add routes in `apps/web/src/app/router.tsx` under the protected tree, e.g.
  `/orgs/:orgSlug/projects/:projectKey/environments/:envKey/flags` (list) and `.../flags/:flagKey`
  (editor). Reuse `RequireAuth` (already redirects unauthenticated -> `/login`, AC11 first half).
- Read the caller's role via `useOrgRole(orgSlug)` (`apps/web/src/auth/auth-context.tsx`). If `member`,
  render the editor read-only (disable inputs + hide/disable Save) since a member PATCH returns
  `403 SNEAKY_OWL`; admins/owners get the editable form. Preview stays available to members.
- The list/editor read project + env from route params.

## Verification

- Component/route test: unauthenticated -> redirect to `/login`; a `member` sees a read-only editor
  (Save disabled); an `admin` sees editable controls.
- `pnpm --filter @togglr/web typecheck && pnpm --filter @togglr/web test` green.

## Notes

- `useOrgRole` resolves owner/admin/member from memberships; mirror the `canManage` checks used elsewhere.
- Members retain read + preview; only mutations are gated (matches the API: config PATCH admin-only,
  GET + preview member-level).
