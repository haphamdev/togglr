---
title: "togglr — Error Codes"
status: draft
owner: hapham
date: 2026-07-29
parent: docs/api/togglr-api.md
---

# togglr — Error Codes

This is the authoritative registry for every `error.code` togglr returns. All non-2xx
responses use the shape `{ "error": { "code", "message" } }`, and this document is the
**single source of truth** for what each `code` means. The [API contract](togglr-api.md)
references these codes but does not define them — their meaning lives here.

Codes are **animal-themed and intentionally opaque**: the animal names a domain group, and
the adjective names the specific error within that group. A code carries no semantic
guarantee in its spelling — you look up its meaning in this registry rather than parsing it.

## Scheme

- Format: `ADJECTIVE_ANIMAL`.
- **Animal** = the domain group the error belongs to (see the legend below).
- **Adjective** = the specific error, chosen for memorability. It is unique within its
  animal group, so every full code is globally unique.

## Animal legend

| Animal | Domain group |
| --- | --- |
| OWL | Common / cross-cutting |
| FOX | Auth & Session |
| BEE | Invite |
| PIG | Organization |
| RAM | Member |
| DOG | Project |
| DUCK | Environment |
| CAT | Flag (incl. per-environment config & rules) |
| BAT | SDK key / hot path |

## Registry

Every `error.code` togglr can return, sorted alphabetically by code.

| Code | Animal | HTTP | Meaning | Where it happens |
| --- | --- | --- | --- | --- |
| `BLIND_BAT` | BAT | 401 | Missing/unknown/revoked/expired SDK key (generic — no distinction, to avoid probing). | `GET /sdk/v1/ruleset` |
| `BUSY_BEE` | BEE | 409 | A pending invite for this email already exists (use resend). | `POST /orgs/:orgSlug/invites` |
| `CLUMSY_OWL` | OWL | 400 | Malformed body / failed field validation (details in `message`). | any request with a body |
| `COZY_BEE` | BEE | 409 | Email already belongs to the org. | `POST /orgs/:orgSlug/invites` |
| `CURIOUS_CAT` | CAT | 400 | Malformed rule/condition/result (bad operator, percentage out of `0..100`, empty `values`, unknown `kind`). | `PATCH …/config`; `POST …/preview` |
| `DIZZY_OWL` | OWL | 503 | Redis (sessions) or Postgres unavailable. | any route; `GET /healthz` |
| `FAT_CAT` | CAT | 409 | Flag key already used in this project. | `POST …/flags` |
| `FUNNY_PIG` | PIG | 409 | Org slug already in use. | `POST /orgs` |
| `GREEDY_FOX` | FOX | 409 | An account with this email already exists. | `POST /auth/signup` |
| `GRUMPY_CAT` | CAT | 400 | Flag key fails `^[a-z0-9-]+$`. | `POST …/flags` |
| `GRUMPY_OWL` | OWL | 403 | Missing/mismatched `X-CSRF-Token` on a mutation. | any session-auth mutation |
| `HAPPY_BEE` | BEE | 409 | Invite already consumed. | invite preview/accept; `POST …/resend` |
| `JEALOUS_CAT` | CAT | 409 | `expectedConfigVersion` ≠ stored version (concurrent edit/rollback); client refetches. | `PATCH …/config` |
| `LONELY_OWL` | OWL | 403 | Authenticated, but not a member of the target org. | any org-scoped route |
| `LONELY_RAM` | RAM | 409 | Would demote/remove the only remaining owner. | `PATCH`/`DELETE …/members/:userId` |
| `LOST_BEE` | BEE | 404 | No pending invite for this token. | `GET /auth/invites/:token`; `POST …/accept` |
| `LOST_OWL` | OWL | 404 | Path resource does not exist within the caller's tenant. | any path resource (members, invites, keys, …) |
| `NOISY_DUCK` | DUCK | 409 | Environment key already used in this project. | `POST …/environments` |
| `PUZZLED_FOX` | FOX | 403 | Session user's email ≠ invited email (existing-account accept). | `POST /auth/invites/:token/accept` |
| `SHY_FOX` | FOX | 400 | Invite-accept for a new account with no `password`. | `POST /auth/invites/:token/accept` |
| `SLEEPY_DOG` | DOG | 409 | Project key already used in this org. | `POST /orgs/:orgSlug/projects` |
| `SLEEPY_OWL` | OWL | 401 | Missing/invalid/expired session. | any authed control-plane route |
| `SLY_FOX` | FOX | 401 | Email/password mismatch (generic — no user enumeration). | `POST /auth/login` |
| `SNEAKY_OWL` | OWL | 403 | Member of the org, but role too low for the action. | any role-gated action |
| `TIRED_BEE` | BEE | 410 | Invite past `expiresAt`. | `GET /auth/invites/:token`; `POST …/accept` |

## Adding a new error code

1. Find the animal for the resource in the [legend](#animal-legend). Add a new animal only
   for a genuinely new domain group.
2. Pick an unused adjective for that animal (it must be unique within the animal group).
3. Add the row to the registry table above **first** — this registry is the source of truth.
4. Reference the new code from the relevant endpoint in [togglr-api.md](togglr-api.md).

## Not error codes

The evaluation `reason` enum (`RULE_MATCH`, `ROLLOUT`, `DEFAULT`, `FLAG_OFF`,
`FLAG_NOT_FOUND`, `SDK_NOT_READY`, `MISSING_KEY`, `TYPE_MISMATCH`) is an evaluation-result
outcome, **not** an API error, and is defined in
[Ruleset & Evaluation + SDK](../design/ruleset-evaluation-sdk.md), not here.
