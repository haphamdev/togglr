import { randomUUID } from "node:crypto";
import Redis from "ioredis";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "./database";

interface CountRow {
  n: number;
}

function makeDb(connectionString: string): Kysely<Database> {
  return new Kysely<Database>({
    dialect: new PostgresDialect({ pool: new Pool({ connectionString }) }),
  });
}

const ACTION = "ci-rls-roundtrip";

describe("audit_logs RLS round-trip (integration)", () => {
  let dbApp: Kysely<Database>;
  let dbAdmin: Kysely<Database>;
  const orgA = randomUUID();
  const orgB = randomUUID();

  beforeAll(() => {
    dbApp = makeDb(process.env.DATABASE_URL as string);
    dbAdmin = makeDb(process.env.DATABASE_MIGRATION_URL as string);
  });

  afterAll(async () => {
    // togglr_app cannot DELETE audit_logs (append-only); clean up as admin.
    await sql`DELETE FROM audit_logs WHERE action = ${ACTION}`.execute(dbAdmin);
    await dbApp.destroy();
    await dbAdmin.destroy();
  });

  it("inserts and reads its own org's row inside the tenant context", async () => {
    const count = await dbApp.transaction().execute(async (trx) => {
      await sql`SELECT set_config('app.current_org', ${orgA}, true)`.execute(trx);
      await sql`INSERT INTO audit_logs (organization_id, action) VALUES (${orgA}, ${ACTION})`.execute(
        trx,
      );
      const result = await sql<CountRow>`
        SELECT count(*)::int AS n FROM audit_logs WHERE action = ${ACTION}
      `.execute(trx);
      return result.rows[0]?.n ?? 0;
    });
    expect(count).toBe(1);
  });

  it("hides another org's rows under a different tenant context (RLS isolation)", async () => {
    const count = await dbApp.transaction().execute(async (trx) => {
      await sql`SELECT set_config('app.current_org', ${orgB}, true)`.execute(trx);
      const result = await sql<CountRow>`
        SELECT count(*)::int AS n FROM audit_logs WHERE action = ${ACTION}
      `.execute(trx);
      return result.rows[0]?.n ?? 0;
    });
    expect(count).toBe(0);
  });

  it("returns zero rows with no tenant context (fail-closed)", async () => {
    const result = await sql<CountRow>`
      SELECT count(*)::int AS n FROM audit_logs WHERE action = ${ACTION}
    `.execute(dbApp);
    expect(result.rows[0]?.n).toBe(0);
  });
});

describe("Redis round-trip (integration)", () => {
  let redis: Redis;

  beforeAll(() => {
    redis = new Redis(process.env.REDIS_URL as string);
  });

  afterAll(async () => {
    await redis.del("ci:roundtrip");
    redis.disconnect();
  });

  it("performs a SET then GET", async () => {
    await redis.set("ci:roundtrip", "pong");
    expect(await redis.get("ci:roundtrip")).toBe("pong");
  });
});
