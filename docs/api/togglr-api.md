---
title: "togglr — API Contract (Phase 1)"
status: approved
owner: hapham
date: 2026-07-28
parent: docs/design/architecture-overview.md
---

# togglr — API Contract (Phase 1)

## Overview

The wire contract for togglr's two API surfaces:

- **Control plane** (`/api/v1`) — consumed by the React admin SPA. Session-cookie auth
  with CSRF. Covers auth/sessions, orgs/members/invites, projects, environments, SDK keys,
  flag authoring, per-environment config, and server-side preview. Realizes the
  [Control Plane & Data Model](../design/control-plane-data-model.md) design.
- **SDK hot path** (`/sdk/v1`) — consumed by the server-side SDK. Per-environment SDK-key
  auth. One endpoint: conditional-GET ruleset fetch. Realizes the
  [Ruleset & Evaluation Engine + SDK](../design/ruleset-evaluation-sdk.md) design.

Shared payload shapes (`Ruleset`, `FlagConfig`, `Rule`, `Condition`, `RuleResult`,
`EvaluationContext`, `EvaluationResult`) are the TypeScript types in
`packages/shared-types` and are serialized verbatim — see the hot-path design doc for the
canonical definitions.

## Conventions

- **Base URLs:** `/api/v1` (control plane), `/sdk/v1` (SDK hot path), `/healthz` (unauthed).
- **Auth (control plane):** an `httpOnly; Secure; SameSite=Lax` session cookie
  (`togglr_session`). All **session-authenticated** mutating requests
  (`POST`/`PATCH`/`PUT`/`DELETE`) must also send the per-session CSRF token in an
  `X-CSRF-Token` header; the SPA reads the token from `GET /auth/me` (or the login/signup
  response). The unauthenticated bootstrap POSTs — `/auth/signup`, `/auth/login`, and
  `/auth/invites/:token/accept` when creating a new account — carry no session and are
  CSRF-exempt (`SameSite=Lax` plus their credential-bearing nature is the control). The
  session cookie is never exposed to JS.
- **Auth (SDK):** `Authorization: Bearer <sdkKey>`. Keys are per-environment and resolve
  the tenant; no cookie/CSRF.
- **Tenant scoping:** the org is identified by its **immutable slug** in the path
  (`/api/v1/orgs/:orgSlug/…`). The org is resolved from the path and membership is checked
  *before* the RLS transaction opens (`SET LOCAL app.current_org`). Every tenant-scoped
  read/write then runs inside that transaction. *(Deployment note: this maps 1:1 to
  `:orgSlug.togglr.<host>` subdomains later without a contract change.)*
- **Identifiers in paths:** readable immutable keys where a natural one exists —
  `:orgSlug`, `:projectKey`, `:envKey`, `:flagKey` (pattern `^[a-z0-9-]+$`, immutable after
  creation). UUIDs where there is no natural key — `:userId`, `:inviteId`, `:keyId`.
- **JSON casing:** camelCase in all request/response bodies (matches the `shared-types` TS
  shapes; no field translation).
- **Timestamps:** ISO-8601 UTC strings (e.g. `2026-07-28T10:15:30.000Z`).
- **Error format:** every non-2xx returns
  `{ "error": { "code": "ERROR_CODE", "message": "Human-readable message" } }`.
  Codes are animal-themed and opaque; see the [Error Codes registry](error-codes.md) for the authoritative meaning of every code.
- **Optimistic concurrency:** flag-config edits carry `expectedConfigVersion`; a stale value
  ⇒ **409** `JEALOUS_CAT` and the client refetches.
- **Pagination:** none in Phase 1 — all list resources are bounded. The flags list is the
  only likely-to-grow collection; cursor pagination is its documented forward path (Open
  Questions), not built now.
- **Versioning:** URL-versioned (`/api/v1`, `/sdk/v1`). Additive changes are non-breaking;
  breaking changes bump the version segment.

### Common errors

These may be returned by the endpoints indicated and are omitted from per-endpoint tables:

| Code | `error.code` | When |
| --- | --- | --- |
| 401 | `SLEEPY_OWL` | Missing/invalid/expired session (any authed control-plane route). |
| 403 | `GRUMPY_OWL` | Missing/mismatched `X-CSRF-Token` on a mutation. |
| 403 | `LONELY_OWL` | Authenticated, but not a member of the target org. |
| 403 | `SNEAKY_OWL` | Member of the org, but role too low for the action. |
| 400 | `CLUMSY_OWL` | Malformed body / failed field validation (details in `message`). |
| 404 | `LOST_OWL` | Path resource does not exist within the caller's tenant. |
| 503 | `DIZZY_OWL` | Redis (sessions) or Postgres unavailable — see design failure modes. |

**Role model:** `member` < `admin` < `owner`. `member` = read + preview; `admin` = author
flags, manage environments/keys, manage invites; `owner` = manage org + members. Enforced by
`RolesGuard` in addition to RLS.

---

## Health

### GET /healthz

**Description:** Liveness/readiness probe; reports dependency health.
**Auth:** none.

**Response (200):**

| Field | Type | Description |
| --- | --- | --- |
| `status` | string | `ok` when all checks pass. |
| `checks.postgres` | boolean | Postgres reachable. |
| `checks.redis` | boolean | Redis reachable. |

```json
{ "status": "ok", "checks": { "postgres": true, "redis": true } }
```

**Errors:** `503 DIZZY_OWL` if any dependency check fails (body carries the same
shape with `status: "degraded"`).

---

## Auth & Sessions

Bootstrap flows — no org context. Session cookie set/cleared by these endpoints.

### POST /auth/signup

**Description:** Create a new user account (email + password). Does **not** create an org.
No email verification in MVP (deferred).
**Auth:** none.

**Request:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `email` | string | yes | Unique; lowercased. |
| `password` | string | yes | Min length enforced (≥ 10). Hashed with argon2id. |
| `name` | string | no | Display name. |

```json
{ "email": "ada@example.com", "password": "correct-horse-battery", "name": "Ada" }
```

**Response (201):** starts a session (sets `togglr_session` cookie), returns the user and CSRF token.

```json
{ "user": { "id": "6f1c…", "email": "ada@example.com", "name": "Ada" }, "csrfToken": "b3a9…" }
```

**Errors:**

| Code | `error.code` | When |
| --- | --- | --- |
| 409 | `GREEDY_FOX` | An account with this email already exists. |

### POST /auth/login

**Description:** Authenticate and start a session.
**Auth:** none.

**Request:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `email` | string | yes | |
| `password` | string | yes | |

**Response (200):** sets `togglr_session`; returns user, memberships, CSRF token.

```json
{
  "user": { "id": "6f1c…", "email": "ada@example.com", "name": "Ada" },
  "memberships": [ { "slug": "acme-inc", "name": "Acme Inc", "role": "owner" } ],
  "csrfToken": "b3a9…"
}
```

**Errors:**

| Code | `error.code` | When |
| --- | --- | --- |
| 401 | `SLY_FOX` | Email/password mismatch (generic, no user enumeration). |

### POST /auth/logout

**Description:** End the current session (deletes the Redis session key, clears cookie).
**Auth:** session.
**Response (204):** empty.

### POST /auth/logout-all

**Description:** Revoke **all** sessions for the current user (deletes every
`session:<token>` in the user's `user_sessions` set).
**Auth:** session.
**Response (204):** empty.

### GET /auth/me

**Description:** Current user, org memberships, and CSRF token. SPA session bootstrap.
**Auth:** session.

**Response (200):**

| Field | Type | Description |
| --- | --- | --- |
| `user` | object | `{ id, email, name }`. |
| `memberships` | array | `[{ slug, name, role }]`. |
| `csrfToken` | string | Per-session CSRF token for `X-CSRF-Token`. |

```json
{
  "user": { "id": "6f1c…", "email": "ada@example.com", "name": "Ada" },
  "memberships": [ { "slug": "acme-inc", "name": "Acme Inc", "role": "owner" } ],
  "csrfToken": "b3a9…"
}
```

### GET /auth/invites/:token

**Description:** Preview an invite before accepting (unauthenticated — the token is the
capability). Lets the accept screen show which org/role and whether an account is needed.
**Auth:** none (token in path).

**Response (200):**

| Field | Type | Description |
| --- | --- | --- |
| `orgName` | string | Inviting org. |
| `email` | string | Invited email (pre-fills the form). |
| `role` | string | Role to be granted. |
| `userExists` | boolean | Whether an account already exists for `email`. |
| `expiresAt` | string | Invite expiry. |

**Errors:**

| Code | `error.code` | When |
| --- | --- | --- |
| 404 | `LOST_BEE` | No pending invite for this token. |
| 410 | `TIRED_BEE` | Invite past `expiresAt`. |
| 409 | `HAPPY_BEE` | Invite already consumed. |

### POST /auth/invites/:token/accept

**Description:** Accept an invite → create the membership. Two cases:
(a) no account exists for the invited email → `password` (and optional `name`) required;
creates the user, starts a session, and adds the membership.
(b) an account exists → the caller must be authenticated **as that user** (session); the
membership is added to the existing account.
**Auth:** none (case a) or session matching the invited email (case b).

**Request:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `password` | string | conditional | Required when `userExists` is false. |
| `name` | string | no | Only used when creating the account. |

**Response (200/201):** `201` when a new account is created (session started); `200` when
adding a membership to an existing account.

```json
{ "user": { "id": "9b2e…", "email": "grace@example.com" },
  "membership": { "slug": "acme-inc", "role": "admin" } }
```

**Errors:**

| Code | `error.code` | When |
| --- | --- | --- |
| 404 | `LOST_BEE` | Unknown/void token. |
| 410 | `TIRED_BEE` | Past expiry. |
| 409 | `HAPPY_BEE` | Already consumed. |
| 400 | `SHY_FOX` | Case (a) with no `password`. |
| 403 | `PUZZLED_FOX` | Case (b) session user's email ≠ invited email. |

---

## Organizations

### POST /orgs

**Description:** Create an org; the creator becomes its `owner`. The new org id is set as
the RLS context inside the same transaction so the initial inserts pass `WITH CHECK`.
**Auth:** session.

**Request:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `name` | string | yes | Display name. |
| `slug` | string | yes | Immutable, `^[a-z0-9-]+$`, globally unique. URL + future subdomain label. |

```json
{ "name": "Acme Inc", "slug": "acme-inc" }
```

**Response (201):**

```json
{ "org": { "slug": "acme-inc", "name": "Acme Inc", "role": "owner", "createdAt": "2026-07-28T10:00:00.000Z" } }
```

**Errors:**

| Code | `error.code` | When |
| --- | --- | --- |
| 409 | `FUNNY_PIG` | Slug already in use. |

### GET /orgs

**Description:** List orgs the current user belongs to (with the caller's role).
**Auth:** session.

**Response (200):**

```json
{ "orgs": [ { "slug": "acme-inc", "name": "Acme Inc", "role": "owner", "createdAt": "…" } ] }
```

### GET /orgs/:orgSlug

**Description:** Org detail.
**Auth:** session + membership.

**Response (200):**

```json
{ "org": { "slug": "acme-inc", "name": "Acme Inc", "role": "owner", "createdAt": "…" } }
```

### PATCH /orgs/:orgSlug

**Description:** Rename the org (`slug` is immutable).
**Auth:** session + `owner`.

**Request:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `name` | string | yes | New display name. |

**Response (200):** the updated org object.

---

## Members

### GET /orgs/:orgSlug/members

**Description:** List members and roles.
**Auth:** session + membership.

**Response (200):**

```json
{ "members": [ { "userId": "6f1c…", "email": "ada@example.com", "name": "Ada", "role": "owner", "createdAt": "…" } ] }
```

### PATCH /orgs/:orgSlug/members/:userId

**Description:** Change a member's role.
**Auth:** session + `owner`.

**Request:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `role` | string | yes | `owner` \| `admin` \| `member`. |

**Response (200):** the updated member.

**Errors:**

| Code | `error.code` | When |
| --- | --- | --- |
| 404 | `LOST_OWL` | No such member in this org. |
| 409 | `LONELY_RAM` | Would demote the only remaining owner. |

### DELETE /orgs/:orgSlug/members/:userId

**Description:** Remove a member from the org.
**Auth:** session + `owner`.
**Response (204):** empty.

**Errors:**

| Code | `error.code` | When |
| --- | --- | --- |
| 404 | `LOST_OWL` | No such member. |
| 409 | `LONELY_RAM` | Would remove the only remaining owner. |

---

## Invites

### POST /orgs/:orgSlug/invites

**Description:** Invite an email to the org at a role. Generates a hashed token and emails a
link (Mailhog in dev).
**Auth:** session + `admin`.

**Request:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `email` | string | yes | Invitee email. |
| `role` | string | yes | Role to grant on accept. |

**Response (201):**

```json
{ "invite": { "id": "d4c1…", "email": "grace@example.com", "role": "admin",
  "status": "pending", "expiresAt": "2026-08-04T10:00:00.000Z", "createdAt": "…" } }
```

**Errors:**

| Code | `error.code` | When |
| --- | --- | --- |
| 409 | `COZY_BEE` | Email already belongs to the org. |
| 409 | `BUSY_BEE` | A pending invite for this email already exists (use resend). |

### GET /orgs/:orgSlug/invites

**Description:** List pending/expired invites.
**Auth:** session + `admin`.

**Response (200):** `{ "invites": [ { "id", "email", "role", "status", "expiresAt", "createdAt" } ] }`

### POST /orgs/:orgSlug/invites/:inviteId/resend

**Description:** Regenerate the token (invalidating the old one) and re-send the email; resets expiry.
**Auth:** session + `admin`.
**Response (200):** the refreshed invite.

**Errors:**

| Code | `error.code` | When |
| --- | --- | --- |
| 404 | `LOST_OWL` | No such invite. |
| 409 | `HAPPY_BEE` | Cannot resend a consumed invite. |

### DELETE /orgs/:orgSlug/invites/:inviteId

**Description:** Revoke a pending invite.
**Auth:** session + `admin`.
**Response (204):** empty.

---

## Projects

### POST /orgs/:orgSlug/projects

**Description:** Create a project. Seeds a default set of environments (`development`,
`staging`, `production`), each with its own ruleset version and key namespace.
**Auth:** session + `admin`.

**Request:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `key` | string | yes | Immutable, `^[a-z0-9-]+$`, unique per org. |
| `name` | string | yes | Display name. |

```json
{ "key": "checkout", "name": "Checkout" }
```

**Response (201):**

```json
{ "project": { "key": "checkout", "name": "Checkout", "createdAt": "…" },
  "environments": [
    { "key": "development", "name": "Development", "rulesetVersion": 0 },
    { "key": "staging", "name": "Staging", "rulesetVersion": 0 },
    { "key": "production", "name": "Production", "rulesetVersion": 0 }
  ] }
```

**Errors:**

| Code | `error.code` | When |
| --- | --- | --- |
| 409 | `SLEEPY_DOG` | Key already used in this org. |

### GET /orgs/:orgSlug/projects

**Description:** List projects.
**Auth:** session + membership.
**Response (200):** `{ "projects": [ { "key", "name", "createdAt" } ] }`

### GET /orgs/:orgSlug/projects/:projectKey

**Description:** Project detail.
**Auth:** session + membership.
**Response (200):** `{ "project": { "key", "name", "createdAt" } }`

### PATCH /orgs/:orgSlug/projects/:projectKey

**Description:** Rename the project (`key` immutable).
**Auth:** session + `admin`.

**Request:** `{ "name": "Checkout v2" }`
**Response (200):** the updated project.

---

## Environments

### POST /orgs/:orgSlug/projects/:projectKey/environments

**Description:** Create an environment.
**Auth:** session + `admin`.

**Request:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `key` | string | yes | Immutable, `^[a-z0-9-]+$`, unique per project. |
| `name` | string | yes | Display name. |

**Response (201):** `{ "environment": { "key": "canary", "name": "Canary", "rulesetVersion": 0, "archivedAt": null, "createdAt": "…" } }`

**Errors:**

| Code | `error.code` | When |
| --- | --- | --- |
| 409 | `NOISY_DUCK` | Key already used in this project. |

### GET /orgs/:orgSlug/projects/:projectKey/environments

**Description:** List environments (with current ruleset version).
**Auth:** session + membership.
**Response (200):** `{ "environments": [ { "key", "name", "rulesetVersion", "archivedAt", "createdAt" } ] }`

### GET /orgs/:orgSlug/projects/:projectKey/environments/:envKey

**Description:** Environment detail.
**Auth:** session + membership.
**Response (200):** `{ "environment": { "key", "name", "rulesetVersion", "archivedAt", "createdAt" } }`

### PATCH /orgs/:orgSlug/projects/:projectKey/environments/:envKey

**Description:** Rename or archive the environment (`key` immutable). Archiving is reversible and dashboard-only — the env's SDK keys keep serving until revoked.
**Auth:** session + `admin`.

**Request:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `name` | string | no | New display name. |
| `archived` | boolean | no | `true` sets `archivedAt`, `false` clears it. |

At least one of `name` / `archived` is required (empty body → `400 CLUMSY_OWL`). Idempotent:
re-archiving preserves the original `archivedAt`. The archived env's `key` stays reserved, so
re-creating an env with that key returns `409 NOISY_DUCK` until it is restored.

**Response (200):** the updated environment.

---

## SDK Keys

Path prefix: `/orgs/:orgSlug/projects/:projectKey/environments/:envKey/keys`.

### POST …/keys

**Description:** Issue a new SDK key for the environment. The plaintext secret is returned
**once** and never retrievable again; only `prefix` + SHA-256 hash are stored.
**Auth:** session + `admin`.

**Request:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `name` | string | no | Human label for the key. |

**Response (201):**

| Field | Type | Description |
| --- | --- | --- |
| `id` | string (uuid) | Key id. |
| `secret` | string | Plaintext `tgl_<envPrefix>_<random>` — **shown once**. |
| `prefix` | string | Non-secret lookup prefix. |
| `name` | string\|null | Label. |
| `status` | string | `active`. |
| `expiresAt` | string\|null | `null` for a fresh key. |
| `createdAt` | string | |

```json
{ "id": "a1b2…", "secret": "tgl_prod_9f83k2…", "prefix": "tgl_prod_9f83",
  "name": "server-1", "status": "active", "expiresAt": null, "createdAt": "…" }
```

### GET …/keys

**Description:** List keys for the environment. **Never** returns the secret.
**Auth:** session + `admin`.

```json
{ "keys": [ { "id": "a1b2…", "prefix": "tgl_prod_9f83", "name": "server-1",
  "status": "active", "lastUsedAt": "…", "expiresAt": null, "createdAt": "…" } ] }
```

### POST …/keys/:keyId/rotate

**Description:** Issue a replacement key and put the rotated key into its grace window
(`expires_at = now() + grace`, default 24 h, configurable). Both authenticate until the old
key expires. Returns the new secret (shown once).
**Auth:** session + `admin`.

**Response (201):**

```json
{ "newKey": { "id": "c3d4…", "secret": "tgl_prod_h2k9…", "prefix": "tgl_prod_h2k9",
  "status": "active", "expiresAt": null, "createdAt": "…" },
  "rotatedKey": { "id": "a1b2…", "status": "active", "expiresAt": "2026-07-29T10:00:00.000Z" } }
```

**Errors:** `404 LOST_OWL` — no such key in this environment.

### DELETE …/keys/:keyId

**Description:** Revoke a key immediately (`status = revoked`). Subsequent SDK requests with
it get `401`.
**Auth:** session + `admin`.
**Response (204):** empty.

---

## Flags

### POST /orgs/:orgSlug/projects/:projectKey/flags

**Description:** Create a flag at project scope. Seeds a disabled config
(`enabled=false`, `defaultVariation=false`, `rules=[]`, `configVersion=0`) in **every**
environment of the project.
**Auth:** session + `admin`.

**Request:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `key` | string | yes | Immutable, `^[a-z0-9-]+$`, unique per project. |
| `description` | string | no | |
| `type` | string | no | `boolean` (only value in MVP; default `boolean`). |

```json
{ "key": "new-checkout-ui", "description": "New checkout flow", "type": "boolean" }
```

**Response (201):**

```json
{ "flag": { "key": "new-checkout-ui", "description": "New checkout flow", "type": "boolean",
  "archivedAt": null, "createdAt": "…" } }
```

**Errors:**

| Code | `error.code` | When |
| --- | --- | --- |
| 400 | `GRUMPY_CAT` | Key fails `^[a-z0-9-]+$`. |
| 409 | `FAT_CAT` | Key already used in this project. |

### GET /orgs/:orgSlug/projects/:projectKey/flags

**Description:** List flags, with a per-environment config summary. Archived flags excluded
unless `includeArchived=true`.
**Auth:** session + membership.

**Query:** `includeArchived` (boolean, default `false`).

**Response (200):**

```json
{ "flags": [ {
  "key": "new-checkout-ui", "description": "New checkout flow", "type": "boolean",
  "archivedAt": null, "createdAt": "…",
  "environments": [ { "envKey": "production", "enabled": true, "defaultVariation": false,
    "ruleCount": 2, "configVersion": 5 } ]
} ] }
```

### GET /orgs/:orgSlug/projects/:projectKey/flags/:flagKey

**Description:** Flag detail + per-environment config summary.
**Auth:** session + membership.
**Response (200):** a single object shaped like a `flags[]` element above.

### PATCH /orgs/:orgSlug/projects/:projectKey/flags/:flagKey

**Description:** Edit flag-level metadata: `description` and archive state. **`key` and
`type` are immutable.** Archiving does not delete config; the SDK returns the caller
`defaultValue` for an archived flag (`FLAG_NOT_FOUND`).
**Auth:** session + `admin`.

**Request:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `description` | string | no | |
| `archived` | boolean | no | `true` sets `archivedAt`, `false` clears it. |

**Response (200):** the updated flag.

---

## Flag Configuration

Per-(flag, environment) state: the master switch, default variation, and ordered rules. This
is where `config_version` optimistic concurrency and the ruleset-version bump live.

### GET …/flags/:flagKey/environments/:envKey/config

Full path: `/orgs/:orgSlug/projects/:projectKey/flags/:flagKey/environments/:envKey/config`.

**Description:** Read the current config for a flag in one environment.
**Auth:** session + membership.

**Response (200):** the config fields, wrapped in a `config` object.

| Field | Type | Description |
| --- | --- | --- |
| `enabled` | boolean | Master switch. |
| `defaultVariation` | Variation | Served when no rule matches / when disabled. |
| `rules` | Rule[] | Ordered; first match wins. `shared-types` shape. |
| `configVersion` | number | Current version — echo back as `expectedConfigVersion` to edit. |
| `updatedAt` | string | |

```json
{
  "config": {
    "enabled": true,
    "defaultVariation": false,
    "rules": [
      { "conditions": [ { "attribute": "plan", "operator": "equals", "values": ["enterprise"] } ],
        "result": { "kind": "variation", "variation": true } },
      { "conditions": [],
        "result": { "kind": "rollout", "percentage": 10, "bucketBy": "key", "variation": true } }
    ],
    "configVersion": 5,
    "updatedAt": "2026-07-28T09:30:00.000Z"
  }
}
```

### PATCH …/flags/:flagKey/environments/:envKey/config

**Description:** Update the config. Partial: any of `enabled`, `defaultVariation`, `rules`
may be present; when `rules` is present it **replaces** the array wholesale (atomic).
Requires `expectedConfigVersion`. On success, in one transaction: writes the config
(`config_version + 1`), bumps the environment `ruleset_version + 1`, and appends an audit
record. A plain toggle is just `{ enabled, expectedConfigVersion }`.
**Auth:** session + `admin`.

**Request:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `expectedConfigVersion` | number | yes | Version the edit is based on. |
| `enabled` | boolean | no | Master switch. |
| `defaultVariation` | Variation | no | Default when no rule matches. |
| `rules` | Rule[] | no | Full replacement of the ordered rule list. |

```json
{ "expectedConfigVersion": 5, "enabled": true,
  "rules": [ { "conditions": [], "result": { "kind": "rollout", "percentage": 25, "bucketBy": "key", "variation": true } } ] }
```

**Response (200):** the updated config wrapped in a `config` object (new `configVersion`, bumped `rulesetVersion`).

```json
{ "config": { "enabled": true, "defaultVariation": false, "rules": [ /* … */ ],
  "configVersion": 6, "rulesetVersion": 43, "updatedAt": "2026-07-28T10:05:00.000Z" } }
```

**Errors:**

| Code | `error.code` | When |
| --- | --- | --- |
| 400 | `CURIOUS_CAT` | Malformed rule/condition/result (bad operator, percentage out of `0..100`, empty `values`, unknown `kind`). |
| 409 | `JEALOUS_CAT` | `expectedConfigVersion` ≠ stored version (concurrent edit / rollback). Client refetches. |

### POST …/flags/:flagKey/environments/:envKey/preview

**Description:** Server-side preview: run `eval-core` over a supplied context against either
a **draft** config (unsaved editor state) or, if `config` is omitted, the saved config.
Returns the exact `EvaluationResult` the SDK would compute (parity).
**Auth:** session + membership.

**Request:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `context` | EvaluationContext | yes | Attributes to evaluate against (e.g. `{ "key": "u-1", "plan": "enterprise" }`). |
| `defaultValue` | Variation | yes | Caller default for non-resolvable cases. |
| `config` | object | no | Draft `{ enabled, defaultVariation, rules }`; omit to preview the saved config. |

```json
{ "context": { "key": "u-1", "plan": "enterprise" }, "defaultValue": false,
  "config": { "enabled": true, "defaultVariation": false,
    "rules": [ { "conditions": [ { "attribute": "plan", "operator": "equals", "values": ["enterprise"] } ],
      "result": { "kind": "variation", "variation": true } } ] } }
```

**Response (200):** the `EvaluationResult` at top level — an operation result, not a resource, so intentionally unwrapped.

```json
{ "value": true, "reason": "RULE_MATCH" }
```

`reason` ∈ `RULE_MATCH | ROLLOUT | DEFAULT | FLAG_OFF | FLAG_NOT_FOUND | MISSING_KEY`
(the resolvable subset; `SDK_NOT_READY`/`TYPE_MISMATCH` are SDK-runtime-only).

With `config` omitted, preview evaluates the saved config; an archived flag then yields `FLAG_NOT_FOUND`.

**Errors:** `400 CURIOUS_CAT` — draft `config` fails validation.

---

## SDK Hot Path

### GET /sdk/v1/ruleset

**Description:** Fetch the caller environment's full ruleset. Conditional GET: the SDK
sends `If-None-Match` with its cached version; unchanged ⇒ `304` (bodyless), changed ⇒
`200` with the ruleset and a new `ETag`. This one endpoint serves both bootstrap and poll.
**Auth:** `Authorization: Bearer <sdkKey>` (SDK-key guard resolves env + org).

**Request headers:**

| Header | Required | Description |
| --- | --- | --- |
| `Authorization` | yes | `Bearer <sdkKey>`. |
| `If-None-Match` | no | Cached ruleset version, quoted (e.g. `"42"`). |

**Response (200):** body is the `Ruleset` (`shared-types`); `ETag: "<version>"`.

```json
{
  "environmentId": "e-9a2b…",
  "version": 43,
  "schemaVersion": 1,
  "flags": [
    { "key": "new-checkout-ui", "type": "boolean", "enabled": true, "defaultVariation": false,
      "rules": [ { "conditions": [], "result": { "kind": "rollout", "percentage": 25, "bucketBy": "key", "variation": true } } ] }
  ]
}
```

**Response (304):** empty body when `If-None-Match` matches the current version.

**Errors:**

| Code | `error.code` | When |
| --- | --- | --- |
| 401 | `BLIND_BAT` | Missing/unknown/revoked/expired key (generic; no distinction, to avoid probing). |

---

## Open Questions

- [ ] Flags-list pagination: unpaginated in Phase 1 (bounded); adopt cursor pagination if a
  project's flag count grows enough to matter.
- [ ] Default seeded environments on project create (`development`/`staging`/`production`) —
  confirm the set, or let the create call supply an initial list.
- [ ] Rate limiting on auth endpoints (login/signup/invite-accept) — a spec-noted abuse
  control, deferred as non-blocking; decide the mechanism (per-IP token bucket) when
  hardening.
- [ ] Destructive deletes (org / project) are omitted in Phase 1. Deleting an environment
  with live SDK keys is a footgun (in-flight SDKs would 401); environment teardown is
  handled instead via reversible archive (`PATCH …/environments/:envKey {archived}`),
  which is dashboard-only and leaves SDK keys serving until revoked. Org/project hard
  delete stays deferred; prefer archive-style semantics with grace if added.
- [ ] Self-service account edits (`PATCH /auth/me` for name, self password change) are
  deferred alongside password reset; add with the invite/email-token machinery later.
- [ ] SDK-key auth transport: `Authorization: Bearer` (chosen) vs a custom `X-Togglr-Key`
  header — revisit only if a proxy strips `Authorization`.
