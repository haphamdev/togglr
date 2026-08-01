---
title: Preview panel (manual context -> value + reason)
status: draft
owner: hapham
date: 2026-08-01
parent: stories/flag-editor-ui.md
sequence: 5
---

# Preview panel

## What

An inline preview panel in the editor: enter a sample context manually, run preview against the current
draft, and show the returned `value` and `reason` before saving.

## Why

Fulfils flag-editor-ui AC3 (preview shows value + reason before saving) and AC10 (calls
`POST .../preview` with the manual context and shows value + reason).

## How

- Manual context entry (a `key` field + attribute rows). On "run preview", call `usePreviewFlag(...)`
  (sequence 1) with `{ context, defaultValue, config }` where `config` is the CURRENT draft in the
  editor (so preview reflects unsaved edits — the draft path).
- Render the returned `{ value, reason }` (reason in
  `{RULE_MATCH, ROLLOUT, DEFAULT, FLAG_OFF, FLAG_NOT_FOUND, MISSING_KEY}`).
- Surface preview errors (400 CURIOUS_CAT for an invalid draft, 400 CLUMSY_OWL for missing
  `defaultValue`) via `error-messages`.

## Verification

- Component test: entering a context + running preview calls the preview mutation with the draft config
  and renders value + reason; an error response renders a readable message.
- `pnpm --filter @togglr/web typecheck` green.

## Notes

- Depends on the `flag-preview` API story being implemented (`POST .../preview`) and the sequence 1 hooks.
- Parity with the SDK is guaranteed server-side (shared eval-core); the panel just displays results.
