---
title: Web flag editor UI
status: approved
owner: hapham
date: 2026-07-30
parent: tasks/epics/flag-authoring.md
size: L
---

# Web flag editor UI

## Story

As a Flag Administrator, I want a web editor for flags, so that I can author defaults, rules, and rollouts and preview them without using the API directly.

## Acceptance Criteria

### AC1: List
- **Given** a project/environment
- **When** I open the flags screen
- **Then** I see each flag's enabled state, default, rule count, and config version.

### AC2: Edit & save
- **Given** a flag
- **When** I edit its default, ordered rules, and rollout %, and toggle enabled
- **Then** save persists via the config API and a concurrent-edit conflict (`409 JEALOUS_CAT`) triggers a refetch.

### AC3: Preview panel
- **Given** a draft
- **When** I enter a sample context
- **Then** the preview panel shows the resulting value and reason before saving.

## Detailed Acceptance Criteria

(Added by BA — edge cases and detailed scenarios)

### AC4: Concurrent-edit conflict UX
- **Given** the editor holds a config loaded at version N and another admin has since saved
- **When** the save returns `409 JEALOUS_CAT`
- **Then** the editor refetches the latest config, shows a conflict notice, and preserves the user's unsaved edits so they can reapply them onto the refreshed base. [api:56; cp:174-176]

### AC5: Optimistic version sent on save
- **Given** a config loaded into the editor
- **When** the user saves
- **Then** the request sends `expectedConfigVersion` equal to the version from the last load. [api:736]

### AC6: Validation surfacing
- **Given** a save that returns `400 CURIOUS_CAT` (bad percentage, empty `values`, bad operator/kind)
- **When** the error is received
- **Then** it is mapped to inline field errors on the offending rule/field, not a generic banner. [api:757]

### AC7: Rule ordering is evaluation order
- **Given** a list of rules in the editor
- **When** the user reorders them
- **Then** the displayed order is the persisted order, which is the evaluation order (first match wins). [api:702]

### AC8: Rollout controls
- **Given** a rollout rule in the editor
- **When** the user edits it
- **Then** the percentage input accepts `0..100` and a `bucketBy` field is available, defaulting to `key`. [ev:81-83]

### AC9: Archived flags hidden by default
- **Given** the flags list
- **When** it renders
- **Then** archived flags are hidden unless a "show archived" toggle is enabled. [api:643]

### AC10: Preview panel parity
- **Given** a draft config and a manually entered context
- **When** the user runs preview
- **Then** the panel calls `POST …/preview` with the manual context and shows the returned `value` and `reason`. [api:760]

### AC11: Auth-aware editor
- **Given** the editor is opened
- **When** the session is invalid
- **Then** a `401` redirects to login; and when the user is a `member`, a save attempt returns `403 SNEAKY_OWL`, so the editor is rendered read-only for members. [api:77-79]

### AC12: Async list states
- **Given** the flags list is loading, empty, or failed to load
- **When** the screen renders
- **Then** distinct loading, empty, and error states are shown — never a blank screen.

## Notes

Consumes `flag-crud`, `flag-config-edit`, `flag-preview` APIs. Depends on `foundation-web-shell` and those three stories.

## Open Questions

