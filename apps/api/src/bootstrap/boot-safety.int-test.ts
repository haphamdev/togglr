import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "../db/database";
import { assertBootSafety } from "./boot-safety";

function makeDb(connectionString: string): Kysely<Database> {
  return new Kysely<Database>({
    dialect: new PostgresDialect({ pool: new Pool({ connectionString }) }),
  });
}

const appUrl = process.env.DATABASE_URL as string;
const adminUrl = process.env.DATABASE_MIGRATION_URL as string;

describe("assertBootSafety (integration)", () => {
  let dbApp: Kysely<Database>;
  let dbAdmin: Kysely<Database>;

  beforeAll(async () => {
    dbApp = makeDb(appUrl);
    dbAdmin = makeDb(adminUrl);
    // A non-RLS probe table owned by admin, readable by togglr_app.
    await sql`CREATE TABLE IF NOT EXISTS rls_off_probe (id int)`.execute(dbAdmin);
    await sql`GRANT SELECT ON rls_off_probe TO togglr_app`.execute(dbAdmin);
    // A same-named decoy in another (off-search_path) schema, RLS disabled, to
    // prove the probe resolves public.audit_logs and not this one.
    await sql`CREATE SCHEMA IF NOT EXISTS probe_decoy`.execute(dbAdmin);
    await sql`CREATE TABLE IF NOT EXISTS probe_decoy.audit_logs (id int)`.execute(dbAdmin);
    await sql`GRANT USAGE ON SCHEMA probe_decoy TO togglr_app`.execute(dbAdmin);
    await sql`GRANT SELECT ON probe_decoy.audit_logs TO togglr_app`.execute(dbAdmin);
  });

  afterAll(async () => {
    await sql`DROP TABLE IF EXISTS rls_off_probe`.execute(dbAdmin);
    await sql`DROP SCHEMA IF EXISTS probe_decoy CASCADE`.execute(dbAdmin);
    await dbApp.destroy();
    await dbAdmin.destroy();
  });

  it("passes as togglr_app with RLS active on audit_logs", async () => {
    await expect(assertBootSafety(dbApp)).resolves.toBeUndefined();
  });

  it("resolves the search_path table, ignoring a same-named table in another schema", async () => {
    // probe_decoy.audit_logs (RLS off) coexists with public.audit_logs (RLS on);
    // to_regclass('audit_logs') must resolve to public via search_path, so this
    // still passes rather than reading the RLS-off decoy.
    await expect(assertBootSafety(dbApp)).resolves.toBeUndefined();
  });

  it("connects the request pool as the togglr_app role", async () => {
    const result = await sql<{ current_user: string }>`SELECT current_user`.execute(dbApp);
    expect(result.rows[0]?.current_user).toBe("togglr_app");
  });

  it("aborts when the role is a superuser / BYPASSRLS", async () => {
    await expect(assertBootSafety(dbAdmin)).rejects.toThrow(/superuser or BYPASSRLS/);
  });

  it("aborts when RLS is not active on the probe table", async () => {
    await expect(assertBootSafety(dbApp, "rls_off_probe")).rejects.toThrow(/RLS is not active/);
  });

  it("aborts when the probe table does not exist", async () => {
    await expect(assertBootSafety(dbApp, "does_not_exist")).rejects.toThrow(/not found/);
  });
});
