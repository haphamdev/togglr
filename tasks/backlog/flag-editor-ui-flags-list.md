---
title: Flags list screen (state, default, rule count, version)
status: draft
owner: hapham
date: 2026-08-01
parent: stories/flag-editor-ui.md
sequence: 2
---

# Flags list screen

## What

A flags list page for a project/environment showing each flag's enabled state, default value, rule
count, and config version, with a "show archived" toggle and distinct async states.

## Why

Fulfils flag-editor-ui AC1 (list columns), AC9 (archived hidden unless toggled), AC12 (distinct
loading / empty / error states — never a blank screen).

## How

- New page component under `apps/web/src/flags/`, rendered at the flags route (wired in sequence 6).
- Use `useFlags(slug, projectKey, { includeArchived })` (sequence 1). Read the per-env config summary
  from `FlagWithEnvironments.environments` for the selected env (`enabled`, `defaultVariation`,
  `ruleCount`, `configVersion`).
- Render with shadcn `Table`; a "show archived" checkbox/toggle drives `includeArchived` (AC9).
- Loading -> spinner/skeleton; empty -> empty-state copy + a "create flag" affordance; error ->
  `errorMessage(error)` in `<p role="alert">` (`apps/web/src/org/error-messages.ts`) (AC12).
- Each row links to the editor route for that flag.

## Verification

- Component test (vitest + testing-library) with mocked hook: rows show state/default/ruleCount/version;
  archived hidden by default and shown when toggled; loading/empty/error each render distinctly.
- `pnpm --filter @togglr/web typecheck` green.

## Notes

- Greenfield — no existing flags UI. Mirror an existing authed list screen (org projects/environments).
- Project/env scoping comes from route params (see sequence 6).
