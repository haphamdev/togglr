---
title: Rename projects & environments in the dashboard
status: approved
owner: hapham
date: 2026-07-31
parent: tasks/epics/org-workspace-isolation.md
size: S
---

# Rename projects & environments in the dashboard

## Story

As a Flag Administrator, I want to rename a project or environment from the web
dashboard, so that I don't have to call the API by hand to fix a display name.

## Context

The rename endpoints already ship and are covered by integration tests
(`PATCH /orgs/:orgSlug/projects/:projectKey`, `PATCH …/environments/:envKey`;
`org-projects` AC3/AC6, `org-environments` AC3). Only the web UI is missing — the
projects, environments, and env-detail pages currently expose list/create but no
rename control.

## Acceptance Criteria

### AC1: Rename a project
- **Given** an `admin`+ on the projects page
- **When** they edit a project's name and save
- **Then** `PATCH …/projects/:projectKey` is sent (`name` only; `key` immutable) and the list reflects the new name.

### AC2: Rename an environment
- **Given** an `admin`+ on the environments (or env-detail) page
- **When** they edit an environment's name and save
- **Then** `PATCH …/environments/:envKey` is sent (`name` only; `key` immutable) and the view reflects the new name.

### AC3: Role gating & errors
- **Given** a `member`
- **When** they attempt a rename
- **Then** the control is hidden/disabled; a server `403 SNEAKY_OWL` (if reached) renders via the existing `errorMessage` mapping, and `404 LOST_OWL` on a stale key is surfaced too.

## Notes

Reuse existing `useRenameProject` / add a `useRenameEnvironment` hook, the shared
UI primitives, and the `role="alert"` error pattern. Depends on `org-projects`,
`org-environments` (both API-complete).
