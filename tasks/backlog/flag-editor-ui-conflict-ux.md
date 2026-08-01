---
title: Concurrent-edit conflict UX (409 JEALOUS_CAT)
status: draft
owner: hapham
date: 2026-08-01
parent: stories/flag-editor-ui.md
sequence: 4
---

# Concurrent-edit conflict UX

## What

When a save returns `409 JEALOUS_CAT`, refetch the latest config, show a conflict notice, and preserve
the user's unsaved edits so they can reapply them onto the refreshed base.

## Why

Fulfils flag-editor-ui AC4 (conflict -> refetch + notice + preserve unsaved edits) and completes AC2's
"a concurrent-edit conflict triggers a refetch."

## How

- On `useUpdateFlagConfig` error with `ApiError.code === "JEALOUS_CAT"`: refetch/invalidate
  `useFlagConfig`, surface a conflict notice (`<p role="alert">` via `error-messages`), and KEEP the
  user's in-progress edits in local form state (do not discard) so they can reapply onto the new
  `configVersion`.
- After the refetch, the new `configVersion` becomes the `expectedConfigVersion` for the next save.

## Verification

- Component test: simulate a save that rejects with JEALOUS_CAT -> editor refetches, shows the conflict
  notice, retains the user's edited fields, and the subsequent save carries the refreshed version.
- `pnpm --filter @togglr/web typecheck` green.

## Notes

- Builds on sequence 3 (editor form). The API returns `409 JEALOUS_CAT` from the optimistic-concurrency
  guard in flag-config PATCH.
