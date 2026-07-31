import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../../app.module";
import { configureApp } from "../../bootstrap/configure-app";
import type { Database } from "../../db/database";
import { SdkKeyService } from "./sdk-key.service";

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

describe("SDK keys (integration)", () => {
  let app: INestApplication;
  let admin: Kysely<Database>;
  let sdkKeys: SdkKeyService;
  const emails: string[] = [];
  const slugs: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    sdkKeys = app.get(SdkKeyService);
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
    const email = `key-${randomUUID()}@example.com`;
    emails.push(email);
    const res = await request(server())
      .post("/api/v1/auth/signup")
      .send({ email, password: PASSWORD, name: "Ada" });
    expect(res.status).toBe(201);
    return { cookie: cookieOf(res), csrf: res.body.csrfToken, email, id: res.body.user.id };
  }

  /** Owner + org + project (with seeded `production` env). Returns identifiers. */
  async function setup(): Promise<{
    owner: User;
    slug: string;
    orgId: string;
    projectKey: string;
    envId: string;
    base: string;
  }> {
    const owner = await register();
    const slug = `key-${randomUUID().slice(0, 8)}`;
    slugs.push(slug);
    const orgRes = await request(server())
      .post("/api/v1/orgs")
      .set("Cookie", owner.cookie)
      .set("X-CSRF-Token", owner.csrf)
      .send({ name: "Team", slug });
    expect(orgRes.status).toBe(201);
    const projectKey = `svc-${randomUUID().slice(0, 6)}`;
    const projRes = await request(server())
      .post(`/api/v1/orgs/${slug}/projects`)
      .set("Cookie", owner.cookie)
      .set("X-CSRF-Token", owner.csrf)
      .send({ key: projectKey, name: "Svc" });
    expect(projRes.status).toBe(201);

    const ids = await sql<{ org_id: string; env_id: string }>`
      SELECT o.id AS org_id, e.id AS env_id
      FROM organizations o
      JOIN projects p ON p.organization_id = o.id
      JOIN environments e ON e.project_id = p.id
      WHERE o.slug = ${slug} AND p.key = ${projectKey} AND e.key = 'production'
    `.execute(admin);

    return {
      owner,
      slug,
      orgId: ids.rows[0].org_id,
      projectKey,
      envId: ids.rows[0].env_id,
      base: `/api/v1/orgs/${slug}/projects/${projectKey}/environments/production/keys`,
    };
  }

  function issue(owner: User, base: string, name?: string) {
    return request(server())
      .post(base)
      .set("Cookie", owner.cookie)
      .set("X-CSRF-Token", owner.csrf)
      .send(name ? { name } : {});
  }

  it("issues a secret once, validates it, and never lists the secret", async () => {
    const { owner, orgId, envId, base } = await setup();
    const res = await issue(owner, base, "server-1");
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(String),
      secret: expect.stringMatching(/^tgl_[0-9a-f]{12}_/),
      prefix: expect.stringMatching(/^tgl_[0-9a-f]{12}$/),
      name: "server-1",
      status: "active",
      expiresAt: null,
      createdAt: expect.any(String),
    });
    const secret = res.body.secret as string;

    // Validate resolves the org + environment and stamps last_used_at.
    const resolved = await sdkKeys.validate(secret);
    expect(resolved).toEqual({ orgId, environmentId: envId });
    const used = await sql<{ last_used_at: Date | null }>`
      SELECT last_used_at FROM sdk_keys WHERE id = ${res.body.id}
    `.execute(admin);
    expect(used.rows[0].last_used_at).not.toBeNull();

    // List omits the secret.
    const list = await request(server())
      .get(base)
      .set("Cookie", owner.cookie)
      .set("X-CSRF-Token", owner.csrf);
    expect(list.status).toBe(200);
    const listed = list.body.keys.find((k: { id: string }) => k.id === res.body.id);
    expect(listed).toBeDefined();
    expect(listed).not.toHaveProperty("secret");
  });

  it("revokes a key so validation denies it (BLIND_BAT)", async () => {
    const { owner, base } = await setup();
    const res = await issue(owner, base);
    const secret = res.body.secret as string;
    expect(await sdkKeys.validate(secret)).not.toBeNull();

    const del = await request(server())
      .delete(`${base}/${res.body.id}`)
      .set("Cookie", owner.cookie)
      .set("X-CSRF-Token", owner.csrf);
    expect(del.status).toBe(204);
    expect(await sdkKeys.validate(secret)).toBeNull();
  });

  it("rotates: both keys authenticate during grace; after old expiry only the new key works", async () => {
    const { owner, base } = await setup();
    const first = await issue(owner, base, "old");
    const oldSecret = first.body.secret as string;

    const rot = await request(server())
      .post(`${base}/${first.body.id}/rotate`)
      .set("Cookie", owner.cookie)
      .set("X-CSRF-Token", owner.csrf);
    expect(rot.status).toBe(201);
    expect(rot.body.newKey.secret).toMatch(/^tgl_[0-9a-f]{12}_/);
    expect(rot.body.rotatedKey).toEqual({
      id: first.body.id,
      status: "active",
      expiresAt: expect.any(String),
    });
    const newSecret = rot.body.newKey.secret as string;

    // Both valid within the grace window.
    expect(await sdkKeys.validate(oldSecret)).not.toBeNull();
    expect(await sdkKeys.validate(newSecret)).not.toBeNull();

    // Move the old key past its grace expiry → only the new key authenticates.
    await sql`UPDATE sdk_keys SET expires_at = now() - interval '1 minute' WHERE id = ${first.body.id}`.execute(
      admin,
    );
    expect(await sdkKeys.validate(oldSecret)).toBeNull();
    expect(await sdkKeys.validate(newSecret)).not.toBeNull();
  });

  it("rotate of an unknown key → LOST_OWL", async () => {
    const { owner, base } = await setup();
    const res = await request(server())
      .post(`${base}/${randomUUID()}/rotate`)
      .set("Cookie", owner.cookie)
      .set("X-CSRF-Token", owner.csrf);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("LOST_OWL");
  });

  it("rejects a non-admin member mutation with SNEAKY_OWL", async () => {
    const { slug, orgId, base } = await setup();
    const member = await register();
    await sql`
      INSERT INTO memberships (organization_id, user_id, role) VALUES (${orgId}, ${member.id}, 'member')
    `.execute(admin);
    void slug;
    const res = await request(server())
      .post(base)
      .set("Cookie", member.cookie)
      .set("X-CSRF-Token", member.csrf)
      .send({});
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("SNEAKY_OWL");
  });
});
