/**
 * Auth & Sessions: global `users` table.
 *
 * The user identity table for credential-based sign-in. It is the one global
 * (non-tenant) control-plane table — carries NO row-level security (cp:66) —
 * because a user exists independently of any org and is looked up during the
 * unauthenticated sign-up/login bootstrap before a tenant context exists.
 *
 * Grants SELECT + INSERT to togglr_app (sign-up inserts; login / `/auth/me`
 * select). No UPDATE/DELETE grant: password reset / account edits are deferred
 * (cp:145). Case-insensitive email uniqueness is enforced by the app lowercasing
 * `email` before insert/lookup plus the UNIQUE constraint (no citext extension).
 * `gen_random_uuid()` comes from pgcrypto, already enabled by the baseline.
 *
 * Idempotent, following baseline conventions: node-pg-migrate wraps this in a
 * transaction and records it in pgmigrations, so a normal `pnpm migrate` skips
 * an already-applied migration; the statements are also individually safe to
 * re-apply (IF NOT EXISTS + GRANT is idempotent).
 *
 * @type {import('node-pg-migrate').MigrationBuilder}
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email text NOT NULL UNIQUE,
      password_hash text NOT NULL,
      name text,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  // Global table: NO row-level security (cp:66). Grant only what the request
  // path needs — sign-up INSERTs, login / me SELECT. No UPDATE/DELETE (cp:145).
  pgm.sql("GRANT SELECT, INSERT ON users TO togglr_app;");
};

exports.down = (pgm) => {
  pgm.sql("DROP TABLE IF EXISTS users;");
};
