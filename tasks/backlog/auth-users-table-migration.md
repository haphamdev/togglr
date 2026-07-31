---
title: users table migration (global identity, argon2 hash)
status: done
owner: hapham
date: 2026-07-30
parent: tasks/stories/auth-signup.md
sequence: 1
---

# users table migration (global identity, argon2 hash)

## What

Add a node-pg-migrate migration creating the global `users` table and register it on the
Kysely `Database` interface. `users` is the only non-tenant/global table (cp:47,66,77) — it
carries **no** RLS.

## Why

Prerequisite for sign-up (auth-signup AC1/AC4/AC7) and login. First real table on the
currently-empty `Database` interface.

## How

- New migration `apps/api/migrations/<ts>_users.js` (timestamp after the baseline), following
  baseline conventions (idempotent, `@type` jsdoc):
  - `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
  - `email text NOT NULL UNIQUE` — stored already-lowercased by the app (see Notes / AC4)
  - `password_hash text NOT NULL`
  - `name text` (nullable; optional display name)
  - `created_at timestamptz NOT NULL DEFAULT now()`
- Do **not** `ENABLE ROW LEVEL SECURITY` — global table (cp:66).
- `GRANT SELECT, INSERT ON users TO togglr_app;` (signup inserts; login/me select). No
  UPDATE/DELETE grant yet (password reset deferred, cp:145).
- Add a `users` interface to `apps/api/src/db/database.ts` (Kysely `Generated<string>` id,
  columns above) — replacing the empty `Database = {}`.

## Verification

`pnpm migrate` applies and is idempotent (re-run → no-op). `psql`: `users` exists with
`relrowsecurity=f`; `has_table_privilege('togglr_app','users','INSERT')`=t, `SELECT`=t,
`UPDATE`=f. Extend the RLS/round-trip int test or add a small migration assertion if useful.

## Notes

Case-insensitive uniqueness (AC4) = app lowercases `email` before insert/lookup + the
`UNIQUE` constraint (no `citext` extension). `gen_random_uuid()` comes from pgcrypto (already
enabled by the baseline).
