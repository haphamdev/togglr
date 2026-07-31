import { randomUUID } from "node:crypto";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "../../db/database";

interface CountRow {
  n: number;
}
interface ResolveRow {
  organization_id: string;
  role: string | null;
}
interface MembershipRow {
  slug: string;
  name: string;
  role: string;
}

/** Count the seeded project visible to the current connection/context. */
function countProject(db: Kysely<Database>, projectId: string): Promise<number> {
  return sql<CountRow>`SELECT count(*)::int AS n FROM projects WHERE id = ${projectId}`
    .execute(db)
    .then((r) => r.rows[0]?.n ?? -1);
}

describe("control-plane RLS isolation (integration)", () => {
  // Request-path role (RLS applies). max:1 forces every transaction below onto
  // the SAME physical connection, so an interleave leak would show (AC3/AC7).
  let dbApp: Kysely<Database>;
  // Migration superuser: seeds rows (bypasses RLS by ownership).
  let dbAdmin: Kysely<Database>;

  const orgA = randomUUID();
  const orgB = randomUUID();
  const slugA = `rls-a-${randomUUID().slice(0, 8)}`;
  const slugB = `rls-b-${randomUUID().slice(0, 8)}`;
  const userId = randomUUID();
  const projectA = randomUUID();

  beforeAll(async () => {
    dbApp = new Kysely<Database>({
      dialect: new PostgresDialect({
        pool: new Pool({ connectionString: process.env.DATABASE_URL as string, max: 1 }),
      }),
    });
    dbAdmin = new Kysely<Database>({
      dialect: new PostgresDialect({
        pool: new Pool({ connectionString: process.env.DATABASE_MIGRATION_URL as string }),
      }),
    });

    await sql`
      INSERT INTO users (id, email, password_hash)
      VALUES (${userId}, ${`rls-${userId}@example.com`}, 'x')
    `.execute(dbAdmin);
    await sql`
      INSERT INTO organizations (id, name, slug)
      VALUES (${orgA}, 'Org A', ${slugA}), (${orgB}, 'Org B', ${slugB})
    `.execute(dbAdmin);
    await sql`
      INSERT INTO memberships (organization_id, user_id, role)
      VALUES (${orgA}, ${userId}, 'admin')
    `.execute(dbAdmin);
    await sql`
      INSERT INTO projects (id, organization_id, key, name)
      VALUES (${projectA}, ${orgA}, 'proj', 'Proj')
    `.execute(dbAdmin);
  });

  afterAll(async () => {
    await sql`DELETE FROM projects WHERE id = ${projectA}`.execute(dbAdmin);
    await sql`DELETE FROM memberships WHERE user_id = ${userId}`.execute(dbAdmin);
    await sql`DELETE FROM organizations WHERE id IN (${orgA}, ${orgB})`.execute(dbAdmin);
    await sql`DELETE FROM users WHERE id = ${userId}`.execute(dbAdmin);
    await dbApp.destroy();
    await dbAdmin.destroy();
  });

  it("AC1: a row is visible under its own org context", async () => {
    const n = await dbApp.transaction().execute(async (trx) => {
      await sql`SELECT set_config('app.current_org', ${orgA}, true)`.execute(trx);
      return countProject(trx as unknown as Kysely<Database>, projectA);
    });
    expect(n).toBe(1);
  });

  it("AC2: another org's row is invisible under a different context", async () => {
    const n = await dbApp.transaction().execute(async (trx) => {
      await sql`SELECT set_config('app.current_org', ${orgB}, true)`.execute(trx);
      return countProject(trx as unknown as Kysely<Database>, projectA);
    });
    expect(n).toBe(0);
  });

  it("AC4: no rows are visible with no tenant context (fail-closed)", async () => {
    expect(await countProject(dbApp, projectA)).toBe(0);
  });

  it("AC3/AC7: reusing the same pooled connection across org A then org B does not leak", async () => {
    const nA = await dbApp.transaction().execute(async (trx) => {
      await sql`SELECT set_config('app.current_org', ${orgA}, true)`.execute(trx);
      return countProject(trx as unknown as Kysely<Database>, projectA);
    });
    const nB = await dbApp.transaction().execute(async (trx) => {
      await sql`SELECT set_config('app.current_org', ${orgB}, true)`.execute(trx);
      return countProject(trx as unknown as Kysely<Database>, projectA);
    });
    // The GUC is transaction-scoped, so after both transactions the reused
    // connection has no lingering context: a bare read is fail-closed.
    const nNone = await countProject(dbApp, projectA);
    expect(nA).toBe(1);
    expect(nB).toBe(0);
    expect(nNone).toBe(0);
  });

  it("app_resolve_membership: member → (orgId, role)", async () => {
    const r = await sql<ResolveRow>`
      SELECT organization_id, role FROM app_resolve_membership(${userId}, ${slugA})
    `.execute(dbApp);
    expect(r.rows[0]).toEqual({ organization_id: orgA, role: "admin" });
  });

  it("app_resolve_membership: non-member → one row with NULL role", async () => {
    const r = await sql<ResolveRow>`
      SELECT organization_id, role FROM app_resolve_membership(${userId}, ${slugB})
    `.execute(dbApp);
    expect(r.rows).toEqual([{ organization_id: orgB, role: null }]);
  });

  it("app_resolve_membership: unknown slug → 0 rows", async () => {
    const r = await sql<ResolveRow>`
      SELECT organization_id, role
      FROM app_resolve_membership(${userId}, ${`nope-${randomUUID().slice(0, 8)}`})
    `.execute(dbApp);
    expect(r.rows.length).toBe(0);
  });

  it("app_user_memberships lists the user's orgs (bootstrap cross-tenant read)", async () => {
    const r = await sql<MembershipRow>`
      SELECT slug, name, role FROM app_user_memberships(${userId})
    `.execute(dbApp);
    expect(r.rows).toEqual([{ slug: slugA, name: "Org A", role: "admin" }]);
  });
});
