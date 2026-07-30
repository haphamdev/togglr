---
title: POST /auth/logout-all + idle/absolute TTL + set pruning
status: draft
owner: hapham
date: 2026-07-30
parent: tasks/stories/auth-revocation-idle-timeout.md
sequence: 1
---

# POST /auth/logout-all + idle/absolute TTL + set pruning

## What

`POST /auth/logout-all` (revoke every session for the user) plus verification of the idle-TTL
(30 min), absolute-lifetime (12 h), and `user_sessions` set-pruning guarantees.

## Why

Fulfills auth-revocation-idle-timeout AC1–AC7.

## How

- `@Post('logout-all')` — protected mutation (SessionGuard + CsrfGuard; missing CSRF → `403
  GRUMPY_OWL`, AC5). `SessionService.destroyAll(userId)` so every prior session is denied on
  its next request (AC1). `204`.
- TTL/pruning logic lives in `SessionService` (auth-session-store, seq1); this task ensures and
  asserts: idle 30-min TTL refreshed per request (AC3), 12-h absolute cap enforced regardless
  of activity (AC4), set pruning of lapsed tokens on read/logout (AC6), Redis down → `503
  DIZZY_OWL` (AC7). Complete any of these here if not already covered by the session module.

## Verification

Integration (real Redis, manipulate stored timestamps/TTLs): logout-all denies all prior
sessions (AC1); idle > 30 min → next request `401 SLEEPY_OWL` (AC2/AC3); `createdAt` > 12 h with
fresh activity → `401` (AC4); logout-all without CSRF → `403` (AC5); set with dead tokens gets
pruned (AC6); Redis down → `503` (AC7).

## Notes

Durations resolved: **30 min idle / 12 h absolute** (story open-Q closed; cp:240). Depends on
the session-store module + guards.
