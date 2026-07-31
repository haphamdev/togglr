/**
 * Org Workspace & Isolation: the multi-tenant control-plane schema.
 *
 * Creates the six tenant-scoped tables (organizations, memberships, invites,
 * projects, environments, sdk_keys), each with row-level security keyed on the
 * transaction-scoped `app.current_org` GUC so one org can never read or mutate
 * another's rows (control-plane-data-model.md:64-92). `organizations` keys its
 * policy on `id`; every other table on `organization_id`.
 *
 * Also creates the four `SECURITY DEFINER` bootstrap-lookup functions — the ONLY
 * sanctioned RLS bypass — owned by the privileged migration role and EXECUTE-
 * granted to togglr_app. They resolve the org context (or an invite / SDK key)
 * BEFORE a tenant transaction exists, so they must run outside RLS; each is
 * parameterized on a trusted identity and returns the minimal row(s).
 *
 * Idempotent following baseline conventions: node-pg-migrate wraps this in a
 * transaction and records it in pgmigrations; the statements are also
 * individually safe to re-apply (IF NOT EXISTS + CREATE OR REPLACE + DROP POLICY
 * IF EXISTS + idempotent GRANT).
 *
 * @type {import('node-pg-migrate').MigrationBuilder}
 */

exports.shorthands = undefined;

// Shared RLS policy predicate. NULLIF('') guards the pooled-connection case where
// the transaction-local GUC reverts to '' (not NULL) after a prior tenant
// request — an unset context yields 0 rows, never a ''::uuid cast error
// (baseline.js:69-71, control-plane-data-model.md:90-91).
const tenantPredicate = (column) =>
  `${column} = NULLIF(current_setting('app.current_org', true), '')::uuid`;

/** Enable RLS + (re)create the tenant_isolation policy for a table. */
function enableRls(pgm, table, column) {
  pgm.sql(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);
  pgm.sql(`DROP POLICY IF EXISTS tenant_isolation ON ${table};`);
  pgm.sql(`
    CREATE POLICY tenant_isolation ON ${table} FOR ALL
      USING (${tenantPredicate(column)})
      WITH CHECK (${tenantPredicate(column)});
  `);
}

exports.up = (pgm) => {
  // --- organizations ---------------------------------------------------------
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS organizations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      slug text NOT NULL UNIQUE,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  enableRls(pgm, "organizations", "id");
  pgm.sql("GRANT SELECT, INSERT, UPDATE ON organizations TO togglr_app;");

  // --- memberships -----------------------------------------------------------
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS memberships (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role text NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (organization_id, user_id)
    );
  `);
  enableRls(pgm, "memberships", "organization_id");
  pgm.sql("GRANT SELECT, INSERT, UPDATE, DELETE ON memberships TO togglr_app;");

  // --- invites ---------------------------------------------------------------
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS invites (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      email text NOT NULL,
      role text NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
      token_hash text NOT NULL UNIQUE,
      status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
      expires_at timestamptz NOT NULL,
      invited_by uuid REFERENCES users(id),
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  enableRls(pgm, "invites", "organization_id");
  pgm.sql("GRANT SELECT, INSERT, UPDATE, DELETE ON invites TO togglr_app;");

  // --- projects --------------------------------------------------------------
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS projects (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      key text NOT NULL,
      name text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (organization_id, key)
    );
  `);
  enableRls(pgm, "projects", "organization_id");
  pgm.sql("GRANT SELECT, INSERT, UPDATE ON projects TO togglr_app;");

  // --- environments ----------------------------------------------------------
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS environments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL,
      project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      key text NOT NULL,
      name text NOT NULL,
      ruleset_version bigint NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (project_id, key)
    );
  `);
  enableRls(pgm, "environments", "organization_id");
  pgm.sql("GRANT SELECT, INSERT, UPDATE ON environments TO togglr_app;");

  // --- sdk_keys --------------------------------------------------------------
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS sdk_keys (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL,
      environment_id uuid NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
      prefix text NOT NULL,
      key_hash text NOT NULL,
      name text,
      status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
      expires_at timestamptz,
      last_used_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  pgm.sql("CREATE INDEX IF NOT EXISTS sdk_keys_prefix_idx ON sdk_keys(prefix);");
  enableRls(pgm, "sdk_keys", "organization_id");
  pgm.sql("GRANT SELECT, INSERT, UPDATE ON sdk_keys TO togglr_app;");

  // --- SECURITY DEFINER bootstrap-lookup functions ---------------------------
  // Owned by the migration superuser, so they run with RLS bypass. Each is
  // parameterized on a trusted identity (session userId, or a token/key hash)
  // and returns only the minimal row(s), so tenant isolation is preserved.
  // REVOKE from PUBLIC + GRANT EXECUTE to togglr_app narrows the callable set.

  // Cross-tenant: a user's orgs (GET /orgs, /auth/me). Inherently cross-org, so
  // cannot run under a single org's RLS context.
  pgm.sql("DROP FUNCTION IF EXISTS app_user_memberships(uuid);");
  pgm.sql(`
    CREATE FUNCTION app_user_memberships(p_user_id uuid)
    RETURNS TABLE(slug text, name text, role text, created_at timestamptz)
    LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
      SELECT o.slug, o.name, m.role, o.created_at
      FROM memberships m
      JOIN organizations o ON o.id = m.organization_id
      WHERE m.user_id = p_user_id
      ORDER BY o.created_at
    $$;
  `);

  // OrgContextGuard: resolve org + caller's role for :orgSlug. 0 rows → unknown
  // org (LOST_OWL); a row with NULL role → org exists but caller not a member
  // (LONELY_OWL).
  pgm.sql(`
    CREATE OR REPLACE FUNCTION app_resolve_membership(p_user_id uuid, p_org_slug text)
    RETURNS TABLE(organization_id uuid, role text)
    LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
      SELECT o.id, m.role
      FROM organizations o
      LEFT JOIN memberships m ON m.organization_id = o.id AND m.user_id = p_user_id
      WHERE o.slug = p_org_slug
    $$;
  `);

  // Invite preview/accept: resolve an invite (+ its org name) by token hash.
  pgm.sql(`
    CREATE OR REPLACE FUNCTION app_invite_resolve(p_token_hash text)
    RETURNS TABLE(
      id uuid,
      organization_id uuid,
      org_name text,
      email text,
      role text,
      status text,
      expires_at timestamptz
    )
    LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
      SELECT i.id, i.organization_id, o.name, i.email, i.role, i.status, i.expires_at
      FROM invites i
      JOIN organizations o ON o.id = i.organization_id
      WHERE i.token_hash = p_token_hash
    $$;
  `);

  // SDK hot path: validate a presented key (prefix + hash), returning its org +
  // env for an active, in-grace key and bumping last_used_at. Nothing → denied.
  pgm.sql(`
    CREATE OR REPLACE FUNCTION app_sdk_key_resolve(p_prefix text, p_key_hash text)
    RETURNS TABLE(organization_id uuid, environment_id uuid)
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
    DECLARE
      v_id uuid;
      v_org uuid;
      v_env uuid;
    BEGIN
      SELECT k.id, k.organization_id, k.environment_id
        INTO v_id, v_org, v_env
      FROM sdk_keys k
      WHERE k.prefix = p_prefix
        AND k.key_hash = p_key_hash
        AND k.status = 'active'
        AND (k.expires_at IS NULL OR k.expires_at > now())
      LIMIT 1;

      IF v_id IS NULL THEN
        RETURN;
      END IF;

      UPDATE sdk_keys SET last_used_at = now() WHERE id = v_id;
      organization_id := v_org;
      environment_id := v_env;
      RETURN NEXT;
    END;
    $$;
  `);

  for (const sig of [
    "app_user_memberships(uuid)",
    "app_resolve_membership(uuid, text)",
    "app_invite_resolve(text)",
    "app_sdk_key_resolve(text, text)",
  ]) {
    pgm.sql(`REVOKE ALL ON FUNCTION ${sig} FROM PUBLIC;`);
    pgm.sql(`GRANT EXECUTE ON FUNCTION ${sig} TO togglr_app;`);
  }
};

exports.down = (pgm) => {
  pgm.sql("DROP FUNCTION IF EXISTS app_sdk_key_resolve(text, text);");
  pgm.sql("DROP FUNCTION IF EXISTS app_invite_resolve(text);");
  pgm.sql("DROP FUNCTION IF EXISTS app_resolve_membership(uuid, text);");
  pgm.sql("DROP FUNCTION IF EXISTS app_user_memberships(uuid);");
  // FK-safe drop order (children before parents).
  pgm.sql("DROP TABLE IF EXISTS sdk_keys;");
  pgm.sql("DROP TABLE IF EXISTS environments;");
  pgm.sql("DROP TABLE IF EXISTS projects;");
  pgm.sql("DROP TABLE IF EXISTS invites;");
  pgm.sql("DROP TABLE IF EXISTS memberships;");
  pgm.sql("DROP TABLE IF EXISTS organizations;");
};
