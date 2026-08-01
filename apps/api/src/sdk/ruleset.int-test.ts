import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { Ruleset } from "@togglr/shared-types";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../app.module";
import { configureApp } from "../bootstrap/configure-app";
import type { Database } from "../db/database";

const PASSWORD = "correct-horse-42";

function cookieOf(res: request.Response): string {
  const raw = res.headers["set-cookie"];
  const header = Array.isArray(raw) ? raw[0] : String(raw);
  return header.split(";")[0];
}

interface User {
  cookie: string;
  csrf: string;
  email: string;
  id: string;
}

describe("Ruleset delivery (integration)", () => {
  let app: INestApplication;
  let admin: Kysely<Database>;
  const emails: string[] = [];
  const slugs: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    admin = new Kysely<Database>({
      dialect: new PostgresDialect({
        pool: new Pool({ connectionString: process.env.DATABASE_MIGRATION_URL as string }),
      }),
    });
  });

  afterAll(async () => {
    if (slugs.length > 0)
      await sql`DELETE FROM organizations WHERE slug = ANY(${slugs})`.execute(admin);
    if (emails.length > 0) await sql`DELETE FROM users WHERE email = ANY(${emails})`.execute(admin);
    await admin.destroy();
    await app.close();
  });

  const server = () => app.getHttpServer();

  async function register(): Promise<User> {
    const email = `rs-${randomUUID()}@example.com`;
    emails.push(email);
    const res = await request(server())
      .post("/api/v1/auth/signup")
      .send({ email, password: PASSWORD, name: "Ada" });
    expect(res.status).toBe(201);
    return { cookie: cookieOf(res), csrf: res.body.csrfToken, email, id: res.body.user.id };
  }

  /** Owner + org + project (seeds development/staging/production envs). */
  async function setup(): Promise<{
    owner: User;
    slug: string;
    orgId: string;
    projectKey: string;
  }> {
    const owner = await register();
    const slug = `rs-${randomUUID().slice(0, 8)}`;
    slugs.push(slug);
    const orgRes = await request(server())
      .post("/api/v1/orgs")
      .set("Cookie", owner.cookie)
      .set("X-CSRF-Token", owner.csrf)
      .send({ name: "Team", slug });
    expect(orgRes.status).toBe(201);
    const orgRow = await sql<{ id: string }>`
      SELECT id FROM organizations WHERE slug = ${slug}
    `.execute(admin);
    const projectKey = `svc-${randomUUID().slice(0, 6)}`;
    const projRes = await request(server())
      .post(`/api/v1/orgs/${slug}/projects`)
      .set("Cookie", owner.cookie)
      .set("X-CSRF-Token", owner.csrf)
      .send({ key: projectKey, name: "Svc" });
    expect(projRes.status).toBe(201);
    return { owner, slug, orgId: orgRow.rows[0].id, projectKey };
  }

  const keysBase = (slug: string, projectKey: string, envKey: string) =>
    `/api/v1/orgs/${slug}/projects/${projectKey}/environments/${envKey}/keys`;

  /** Mint an SDK key for an env → its plaintext secret. */
  async function issueSecret(
    owner: User,
    slug: string,
    projectKey: string,
    envKey: string,
  ): Promise<{ id: string; secret: string }> {
    const res = await request(server())
      .post(keysBase(slug, projectKey, envKey))
      .set("Cookie", owner.cookie)
      .set("X-CSRF-Token", owner.csrf)
      .send({ name: "server" });
    expect(res.status).toBe(201);
    return { id: res.body.id, secret: res.body.secret };
  }

  async function makeFlag(
    owner: User,
    slug: string,
    projectKey: string,
    key: string,
  ): Promise<void> {
    const res = await request(server())
      .post(`/api/v1/orgs/${slug}/projects/${projectKey}/flags`)
      .set("Cookie", owner.cookie)
      .set("X-CSRF-Token", owner.csrf)
      .send({ key });
    expect(res.status).toBe(201);
  }

  function patchConfig(
    owner: User,
    slug: string,
    projectKey: string,
    flagKey: string,
    envKey: string,
    body: object,
  ) {
    return request(server())
      .patch(
        `/api/v1/orgs/${slug}/projects/${projectKey}/flags/${flagKey}/environments/${envKey}/config`,
      )
      .set("Cookie", owner.cookie)
      .set("X-CSRF-Token", owner.csrf)
      .send(body);
  }

  function fetchRuleset(secret: string | null, ifNoneMatch?: string) {
    let req = request(server()).get("/sdk/v1/ruleset");
    if (secret !== null) req = req.set("Authorization", `Bearer ${secret}`);
    if (ifNoneMatch !== undefined) req = req.set("If-None-Match", ifNoneMatch);
    return req;
  }

  it("AC1/AC6: bearer key returns 200 Ruleset with ETag and the created flag (no cookie/CSRF)", async () => {
    const { owner, slug, projectKey } = await setup();
    const flagKey = `flag-${randomUUID().slice(0, 6)}`;
    await makeFlag(owner, slug, projectKey, flagKey);
    const { secret } = await issueSecret(owner, slug, projectKey, "development");

    const res = await fetchRuleset(secret);
    expect(res.status).toBe(200);
    expect(res.headers.etag).toBeDefined();
    const body = res.body as Ruleset;
    expect(body.schemaVersion).toBe(1);
    expect(typeof body.environmentId).toBe("string");
    expect(typeof body.version).toBe("number");
    expect(body.flags.map((f) => f.key)).toContain(flagKey);
  });

  it("AC2/AC4: matching If-None-Match → 304 empty; a stale value → 200 + ETag", async () => {
    const { owner, slug, projectKey } = await setup();
    await makeFlag(owner, slug, projectKey, `flag-${randomUUID().slice(0, 6)}`);
    const { secret } = await issueSecret(owner, slug, projectKey, "development");

    const first = await fetchRuleset(secret);
    expect(first.status).toBe(200);
    const etag = first.headers.etag as string;

    const notModified = await fetchRuleset(secret, etag);
    expect(notModified.status).toBe(304);
    expect(notModified.body).toEqual({});

    const stale = await fetchRuleset(secret, '"999999"');
    expect(stale.status).toBe(200);
    expect(stale.headers.etag).toBe(etag);
  });

  it("AC3: missing key → 401 BLIND_BAT; garbage key → 401 BLIND_BAT", async () => {
    const missing = await fetchRuleset(null);
    expect(missing.status).toBe(401);
    expect(missing.body.error.code).toBe("BLIND_BAT");

    const garbage = await fetchRuleset("tgl_deadbeef_not-a-real-key");
    expect(garbage.status).toBe(401);
    expect(garbage.body.error.code).toBe("BLIND_BAT");
  });

  it("AC5: env isolation — enabling a dev flag does not leak into staging", async () => {
    const { owner, slug, projectKey } = await setup();
    const flagKey = `flag-${randomUUID().slice(0, 6)}`;
    await makeFlag(owner, slug, projectKey, flagKey);
    const dev = await issueSecret(owner, slug, projectKey, "development");
    const staging = await issueSecret(owner, slug, projectKey, "staging");

    const enable = await patchConfig(owner, slug, projectKey, flagKey, "development", {
      enabled: true,
      expectedConfigVersion: 0,
    });
    expect(enable.status).toBe(200);

    const devBody = (await fetchRuleset(dev.secret)).body as Ruleset;
    const stagingBody = (await fetchRuleset(staging.secret)).body as Ruleset;
    expect(devBody.flags.find((f) => f.key === flagKey)?.enabled).toBe(true);
    expect(stagingBody.flags.find((f) => f.key === flagKey)?.enabled).toBe(false);
  });

  it("AC7: rotation — both keys work in grace; old key denied after expiry, new key still works", async () => {
    const { owner, slug, projectKey } = await setup();
    await makeFlag(owner, slug, projectKey, `flag-${randomUUID().slice(0, 6)}`);
    const first = await issueSecret(owner, slug, projectKey, "development");

    const rot = await request(server())
      .post(`${keysBase(slug, projectKey, "development")}/${first.id}/rotate`)
      .set("Cookie", owner.cookie)
      .set("X-CSRF-Token", owner.csrf);
    expect(rot.status).toBe(201);
    const newSecret = rot.body.newKey.secret as string;

    // Both authenticate during the grace window.
    expect((await fetchRuleset(first.secret)).status).toBe(200);
    expect((await fetchRuleset(newSecret)).status).toBe(200);

    // Expire the old key → only the new key authenticates.
    await sql`UPDATE sdk_keys SET expires_at = now() - interval '1 minute' WHERE id = ${first.id}`.execute(
      admin,
    );
    const oldAfter = await fetchRuleset(first.secret);
    expect(oldAfter.status).toBe(401);
    expect(oldAfter.body.error.code).toBe("BLIND_BAT");
    expect((await fetchRuleset(newSecret)).status).toBe(200);
  });
});
