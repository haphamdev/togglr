import { type Kysely, sql } from "kysely";
import type { Database } from "../db/database";

interface RoleRow {
  rolsuper: boolean;
  rolbypassrls: boolean;
}

interface RlsRow {
  relrowsecurity: boolean;
}

/**
 * Refuses to start the API unless its DB role is safe for RLS tenant isolation
 * (control-plane-data-model.md:98-99):
 *   1. the connected role is NOT a superuser and NOT BYPASSRLS, and
 *   2. row-level security is active on a probe table (default `audit_logs`).
 * Throws a named error (aborting boot → non-zero exit) on any violation.
 */
export async function assertBootSafety(
  db: Kysely<Database>,
  probeTable = "audit_logs",
): Promise<void> {
  const roleResult = await sql<RoleRow>`
    SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user
  `.execute(db);
  const role = roleResult.rows[0];
  if (!role) {
    throw new Error("boot-safety: could not resolve the current database role");
  }
  if (role.rolsuper || role.rolbypassrls) {
    throw new Error(
      `boot-safety: request-path DB role must not be superuser or BYPASSRLS ` +
        `(rolsuper=${role.rolsuper}, rolbypassrls=${role.rolbypassrls})`,
    );
  }

  // to_regclass resolves the (optionally schema-qualified) name via the current
  // search_path — the same way the app's own queries resolve it — so the probe
  // matches exactly one table, never an unrelated same-named table in another
  // schema. A NULL result (name not found) yields no rows → the error below.
  const rlsResult = await sql<RlsRow>`
    SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass(${probeTable})
  `.execute(db);
  const rls = rlsResult.rows[0];
  if (!rls) {
    throw new Error(`boot-safety: probe table '${probeTable}' not found — did migrations run?`);
  }
  if (!rls.relrowsecurity) {
    throw new Error(`boot-safety: RLS is not active on probe table '${probeTable}'`);
  }
}
