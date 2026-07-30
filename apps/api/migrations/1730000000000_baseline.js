/**
 * Foundation baseline migration.
 *
 * Creates the pgcrypto extension, the non-privileged request-path role
 * `togglr_app` (NOSUPERUSER / NOBYPASSRLS), and the append-only `audit_logs`
 * table with RLS + the tenant_isolation policy. Grants SELECT/INSERT to
 * togglr_app and REVOKEs UPDATE/DELETE for structural audit immutability.
 *
 * Columns follow control-plane-data-model.md:75; the RLS policy follows the
 * pattern at cp:84-92. No foreign keys — the referenced tables (organizations,
 * users, environments) are owned by later epics. node-pg-migrate wraps this in a
 * transaction and records it in pgmigrations, so re-running `pnpm migrate` skips
 * it (idempotent); the statements below are also individually safe to re-apply.
 *
 * @type {import('node-pg-migrate').MigrationBuilder}
 */

exports.shorthands = undefined;

exports.up = async (pgm) => {
  const appPassword = process.env.TOGGLR_APP_PASSWORD;
  if (!appPassword) {
    throw new Error("TOGGLR_APP_PASSWORD must be set to create the togglr_app role");
  }
  // The password is interpolated into role DDL (role passwords cannot be bound as
  // query parameters), so restrict it to a charset that cannot break out of the
  // single-quoted SQL literal — no single quote, dollar sign, or backslash. This
  // turns a malformed-password bug into a clear, early failure, not broken SQL.
  if (!/^[A-Za-z0-9_\-!@#%^&*()+=.:?]+$/.test(appPassword)) {
    throw new Error(
      "TOGGLR_APP_PASSWORD has unsupported characters; allowed: letters, digits, and _-!@#%^&*()+=.:?",
    );
  }

  pgm.sql("CREATE EXTENSION IF NOT EXISTS pgcrypto;");

  // Postgres has no CREATE ROLE IF NOT EXISTS, so check existence first, then
  // ALTER unconditionally to set the password + attributes — the role's declared
  // state is fully applied whenever this migration runs (fresh DB or an explicit
  // redo). Note: a normal `pnpm migrate` will NOT re-run an already-applied
  // baseline, so rotating TOGGLR_APP_PASSWORD in an existing environment needs a
  // dedicated follow-up migration (or a manual ALTER ROLE), not just a re-migrate.
  const existing = await pgm.db.select("SELECT 1 FROM pg_roles WHERE rolname = 'togglr_app'");
  if (existing.length === 0) {
    pgm.sql("CREATE ROLE togglr_app WITH LOGIN;");
  }
  pgm.sql(
    `ALTER ROLE togglr_app WITH LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD '${appPassword}';`,
  );

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL,
      actor_user_id uuid,
      action text NOT NULL,
      target_type text,
      target_id uuid,
      environment_id uuid,
      before jsonb,
      after jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  pgm.sql("ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;");

  pgm.sql("DROP POLICY IF EXISTS tenant_isolation ON audit_logs;");
  // NULLIF('') guards the pooled-connection case where the transaction-local GUC
  // reverts to '' (not NULL) after a prior tenant request — an unset context must
  // yield 0 rows, never error on a ''::uuid cast (control-plane-data-model.md:90-91).
  pgm.sql(`
    CREATE POLICY tenant_isolation ON audit_logs FOR ALL
      USING (organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid)
      WITH CHECK (organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid);
  `);

  pgm.sql("GRANT SELECT, INSERT ON audit_logs TO togglr_app;");
  pgm.sql("REVOKE UPDATE, DELETE ON audit_logs FROM togglr_app;");
};

exports.down = (pgm) => {
  pgm.sql("DROP POLICY IF EXISTS tenant_isolation ON audit_logs;");
  pgm.sql("DROP TABLE IF EXISTS audit_logs;");
  // Roles and extensions are cluster-wide and left in place on down migration.
};
