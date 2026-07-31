---
title: Manage team members & roles
status: done
owner: hapham
date: 2026-07-30
parent: tasks/epics/org-workspace-isolation.md
size: M
---

# Manage team members & roles

## Story

As an org owner, I want to view members and change their roles, so that I control who can do what.

## Acceptance Criteria

### AC1: List & change
- **Given** membership
- **When** `GET …/members` and (as owner) `PATCH …/members/:userId {role}`
- **Then** members list with roles and a role change succeeds.

### AC2: Last-owner guard
- **Given** the only remaining owner
- **When** demoting or `DELETE …/members/:userId`
- **Then** `409 LONELY_RAM`.

### AC3: Role gating
- **Given** `member` < `admin` < `owner`
- **When** an action exceeds the caller's role
- **Then** it is rejected (`RolesGuard`).

## Detailed Acceptance Criteria

(Added by BA — edge cases and detailed scenarios)

### AC4: Unknown member
- **Given** an owner
- **When** `PATCH`/`DELETE …/members/:userId` targets a `:userId` not in the org
- **Then** `404 LOST_OWL`.

### AC5: Invalid role value
- **Given** an owner
- **When** `PATCH …/members/:userId` sends a `role` outside `owner|admin|member`
- **Then** `400 CLUMSY_OWL`.

### AC6: Owner-only mutations
- **Given** an `admin` or `member`
- **When** they attempt a role change or member removal
- **Then** `403 SNEAKY_OWL` (owner-only, enforced by `RolesGuard`).

### AC7: Self-demotion
- **Given** an owner demoting or removing themselves
- **When** at least one other owner remains
- **Then** it succeeds; when they are the only remaining owner it is blocked with `409 LONELY_RAM`.

### AC8: Missing session
- **Given** no valid session cookie
- **When** any `…/members` route is called
- **Then** `401 SLEEPY_OWL`.

### AC9: Missing/mismatched CSRF on mutation
- **Given** a valid session but a missing or mismatched `X-CSRF-Token`
- **When** `PATCH`/`DELETE …/members/:userId` is called
- **Then** `403 GRUMPY_OWL`.

### AC10: Non-member access
- **Given** an authenticated user who is not a member of the org
- **When** any `…/members` route is called
- **Then** `403 LONELY_OWL`.

### AC11: Backing store unavailable
- **Given** Redis or Postgres is unavailable
- **When** any `…/members` route is called
- **Then** `503 DIZZY_OWL`.

## Notes

Depends on `org-create-manage-orgs`.

## Open Questions

- [x] Last-owner and self-demotion semantics → demote/remove of the only remaining owner is blocked with `409 LONELY_RAM` on both PATCH and DELETE; self-demotion is allowed while another owner remains (api:362,375).
