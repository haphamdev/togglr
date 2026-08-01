---
title: Cache-ready ruleset representation
status: done
owner: hapham
date: 2026-07-30
parent: tasks/epics/ruleset-delivery-contract.md
size: S
---

# Cache-ready ruleset representation

## Story

As a developer, I want the served ruleset assembled through a stable, serializable representation, so that a Redis cache can front it later without a re-cut.

## Acceptance Criteria

### AC1: Stable serialization
- **Given** persisted flag config
- **When** the fetch endpoint builds the ruleset
- **Then** it uses a deterministic, serializable representation (identical output for a given env + version).

### AC2: Cache-addressable
- **Given** the representation
- **When** it is keyed
- **Then** it is keyed/addressable by environment + ruleset version (cache-ready), with no Redis built yet.

## Detailed Acceptance Criteria

(Added by BA — edge cases and detailed scenarios)

### AC3: Deterministic bytes
- **Given** a fixed (env, version)
- **When** the ruleset representation is serialized twice
- **Then** the byte output is identical — stable field order and no embedded timestamps or other per-request non-determinism. [api:813-825]

### AC4: Cache-addressable key
- **Given** the representation
- **When** it is addressed for caching
- **Then** it is keyed by `ruleset:<envId>` with the ruleset `version` carried in the value (so a Phase-2 Redis cache can front it without a re-cut). [ev:119]

### AC5: Full snapshot, not a diff
- **Given** Phase 1/2 delivery
- **When** the ruleset is served
- **Then** the representation is a full snapshot of the environment's ruleset, never a diff. [ev:263; spec:353-355]

### AC6: schemaVersion embedded
- **Given** the representation
- **When** it is inspected
- **Then** it carries the `schemaVersion` field alongside `environmentId`, `version`, and `flags`. [ev:53-58]

### AC7: No Redis in Phase 1
- **Given** this story's scope
- **When** the representation is built
- **Then** it is a representation only — no Redis cache is wired; the actual cache is Phase 2. [ev:119; arch:276]

## Notes

Real-Time Propagation (Phase 2) builds the actual Redis cache. Depends on `ruleset-fetch-endpoint`.

## Open Questions

