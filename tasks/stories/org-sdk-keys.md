---
title: Issue, rotate & revoke SDK keys
status: approved
owner: hapham
date: 2026-07-30
parent: tasks/epics/org-workspace-isolation.md
size: L
---

# Issue, rotate & revoke SDK keys

## Story

As a Flag Administrator, I want to issue, rotate, and revoke per-environment SDK keys, so that machines authenticate to fetch their environment's ruleset with zero-downtime rotation.

## Acceptance Criteria

### AC1: Issue once
- **Given** admin rights
- **When** `POST …/keys`
- **Then** `201` returns the plaintext secret `tgl_<envPrefix>_<random>` **once**; only `prefix` + SHA-256 hash are stored.

### AC2: List hides secret
- **Given** issued keys
- **When** `GET …/keys`
- **Then** the secret is never returned.

### AC3: Rotate with grace
- **Given** a key
- **When** `POST …/keys/:keyId/rotate`
- **Then** a new active key is returned and the rotated key enters a grace window (`expiresAt = now + 24h`, configurable); both authenticate until the old expires, after which the old is denied.

### AC4: Revoke
- **Given** a key
- **When** `DELETE …/keys/:keyId`
- **Then** it is revoked immediately and a subsequent SDK request with it → `401 BLIND_BAT`.

## Detailed Acceptance Criteria

(Added by BA — edge cases and detailed scenarios)

### AC5: Validation guard
- **Given** a presented SDK key
- **When** `SdkKeyGuard` validates it
- **Then** it hashes the key, looks up by `prefix`+`key_hash`, requires `status = active` AND (`expires_at IS NULL OR expires_at > now()`), and updates `last_used_at` on success.

### AC6: Grace-window boundary
- **Given** a rotated key inside its grace window
- **When** requests arrive before and after the old key's `expires_at`
- **Then** both old and new keys authenticate during the window; after `old.expires_at` the old key → `401 BLIND_BAT` while the new key still works.

### AC7: Rotate unknown key
- **Given** an admin
- **When** `POST …/keys/:keyId/rotate` targets a `:keyId` absent in this environment
- **Then** `404 LOST_OWL`.

### AC8: Revoke is immediate and generic
- **Given** a revoked key (`status = revoked`)
- **When** it is presented on the SDK hot path
- **Then** `401 BLIND_BAT` — unknown, revoked, and expired keys are indistinguishable in the response to prevent probing.

### AC9: Secret shown once on issue and rotate
- **Given** key issuance or rotation
- **When** the `201` response is returned
- **Then** the plaintext `tgl_<envPrefix>_<random>` secret is present exactly once (`secret` on issue, `newKey.secret` on rotate); only `prefix` + SHA-256 hash are stored and the secret is never retrievable again.

### AC10: Missing session
- **Given** no valid session cookie
- **When** any `…/keys` control-plane route is called
- **Then** `401 SLEEPY_OWL`.

### AC11: Missing/mismatched CSRF on mutation
- **Given** a valid session but a missing or mismatched `X-CSRF-Token`
- **When** `POST …/keys`, `POST …/keys/:keyId/rotate`, or `DELETE …/keys/:keyId` is called
- **Then** `403 GRUMPY_OWL`.

### AC12: Non-member access
- **Given** an authenticated user who is not a member of the org
- **When** any `…/keys` route is called
- **Then** `403 LONELY_OWL`.

### AC13: Role gating
- **Given** a `member`
- **When** any `…/keys` mutation is attempted
- **Then** `403 SNEAKY_OWL`; key management requires `admin`+.

### AC14: Backing store unavailable
- **Given** Redis or Postgres is unavailable
- **When** any `…/keys` route is called
- **Then** `503 DIZZY_OWL`.

## Notes

This story also provides the **SDK-key validation guard** consumed by `ruleset-fetch-endpoint`. Depends on `org-environments`.

## Open Questions

- [x] Rotation grace-window default and consumer notification → 24 h, configurable; no active notification in Phase 1 — expiry is time-based and consumers rotate proactively (api:583; cp:160-162,244).
