import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
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

describe("Flags CRUD (integration)", () => {
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
    const email = `fc-${randomUUID()}@example.com`;
    emails.push(email);
    const res = await request(server())
      .post("/api/v1/auth/signup")
      .send({ email, password: PASSWORD, name: "Ada" });
    expect(res.status).toBe(201);
    return { cookie: cookieOf(res), csrf: res.body.csrfToken, email, id: res.body.user.id };
  }

  async function makeOrg(u: User): Promise<{ slug: string; orgId: string }> {
    const slug = `fc-${randomUUID().slice(0, 8)}`;
    slugs.push(slug);
    const res = await request(server())
      .post("/api/v1/orgs")
      .set("Cookie", u.cookie)
      .set("X-CSRF-Token", u.csrf)
      .send({ name: "Team", slug });
    expect(res.status).toBe(201);
    const r = await sql<{ id: string }>`SELECT id FROM organizations WHERE slug = ${slug}`.execute(
      admin,
    );
    return { slug, orgId: r.rows[0].id };
  }

  async function makeProject(u: User, slug: string): Promise<string> {
    const key = `proj-${randomUUID().slice(0, 6)}`;
    const res = await request(server())
      .post(`/api/v1/orgs/${slug}/projects`)
      .set("Cookie", u.cookie)
      .set("X-CSRF-Token", u.csrf)
      .send({ key, name: "Proj" });
    expect(res.status).toBe(201);
    return key;
  }

  function createFlag(u: User, slug: string, projectKey: string, body: object) {
    return request(server())
      .post(`/api/v1/orgs/${slug}/projects/${projectKey}/flags`)
      .set("Cookie", u.cookie)
      .set("X-CSRF-Token", u.csrf)
      .send(body);
  }

  it("AC1/AC4: create returns 201 with a per-env summary for every seeded env", async () => {
    const owner = await register();
    const { slug, orgId } = await makeOrg(owner);
    const projectKey = await makeProject(owner, slug);

    const res = await createFlag(owner, slug, projectKey, { key: "new-checkout" });
    expect(res.status).toBe(201);
    expect(res.body.flag).toMatchObject({
      key: "new-checkout",
      type: "boolean",
      archivedAt: null,
      createdAt: expect.any(String),
    });
    const envs = res.body.flag.environments;
    expect(envs.map((e: { envKey: string }) => e.envKey).sort()).toEqual([
      "development",
      "production",
      "staging",
    ]);
    for (const e of envs) {
      expect(e).toMatchObject({
        enabled: false,
        defaultVariation: false,
        ruleCount: 0,
        configVersion: 0,
      });
    }

    // Every environment of the project has a seeded config row.
    const counts = await sql<{ envs: string; configs: string }>`
      SELECT
        (SELECT count(*) FROM environments e
           JOIN projects p ON p.id = e.project_id
          WHERE p.key = ${projectKey} AND p.organization_id = ${orgId}) AS envs,
        (SELECT count(*) FROM flag_env_configs c
           JOIN flags f ON f.id = c.flag_id
           JOIN projects p ON p.id = f.project_id
          WHERE p.key = ${projectKey} AND f.key = 'new-checkout') AS configs
    `.execute(admin);
    expect(counts.rows[0].configs).toBe(counts.rows[0].envs);
  });

  it("AC2: invalid key → 400 GRUMPY_CAT; duplicate key → 409 FAT_CAT", async () => {
    const owner = await register();
    const { slug } = await makeOrg(owner);
    const projectKey = await makeProject(owner, slug);

    const bad = await createFlag(owner, slug, projectKey, { key: "Bad_Key" });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe("GRUMPY_CAT");

    await createFlag(owner, slug, projectKey, { key: "dupe-flag" }).expect(201);
    const dup = await createFlag(owner, slug, projectKey, { key: "dupe-flag" });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe("FAT_CAT");
  });

  it("AC3/AC6: archive/restore reversibly; list filters archived; re-archive preserves timestamp", async () => {
    const owner = await register();
    const { slug } = await makeOrg(owner);
    const projectKey = await makeProject(owner, slug);
    await createFlag(owner, slug, projectKey, { key: "arch-flag" }).expect(201);
    const base = `/api/v1/orgs/${slug}/projects/${projectKey}/flags`;

    const archived = await request(server())
      .patch(`${base}/arch-flag`)
      .set("Cookie", owner.cookie)
      .set("X-CSRF-Token", owner.csrf)
      .send({ archived: true });
    expect(archived.status).toBe(200);
    expect(archived.body.flag.archivedAt).toEqual(expect.any(String));

    // list without query omits archived; ?includeArchived=true includes it.
    const listed = await request(server()).get(base).set("Cookie", owner.cookie);
    expect(listed.body.flags.map((f: { key: string }) => f.key)).not.toContain("arch-flag");
    const listedAll = await request(server())
      .get(`${base}?includeArchived=true`)
      .set("Cookie", owner.cookie);
    expect(listedAll.body.flags.map((f: { key: string }) => f.key)).toContain("arch-flag");

    // Re-archiving preserves the original timestamp (COALESCE).
    const rearchived = await request(server())
      .patch(`${base}/arch-flag`)
      .set("Cookie", owner.cookie)
      .set("X-CSRF-Token", owner.csrf)
      .send({ archived: true });
    expect(rearchived.body.flag.archivedAt).toBe(archived.body.flag.archivedAt);

    // Restore clears archivedAt.
    const restored = await request(server())
      .patch(`${base}/arch-flag`)
      .set("Cookie", owner.cookie)
      .set("X-CSRF-Token", owner.csrf)
      .send({ archived: false });
    expect(restored.status).toBe(200);
    expect(restored.body.flag.archivedAt).toBeNull();
  });

  it("AC5: type:'string' → 400 CLUMSY_OWL; key is immutable across PATCH", async () => {
    const owner = await register();
    const { slug } = await makeOrg(owner);
    const projectKey = await makeProject(owner, slug);

    const badType = await createFlag(owner, slug, projectKey, { key: "typed", type: "string" });
    expect(badType.status).toBe(400);
    expect(badType.body.error.code).toBe("CLUMSY_OWL");

    await createFlag(owner, slug, projectKey, { key: "immut" }).expect(201);
    const base = `/api/v1/orgs/${slug}/projects/${projectKey}/flags`;
    // A PATCH carrying a bogus `key` field is ignored (no such field); key unchanged.
    await request(server())
      .patch(`${base}/immut`)
      .set("Cookie", owner.cookie)
      .set("X-CSRF-Token", owner.csrf)
      .send({ description: "d", key: "renamed" })
      .expect(200);
    const detail = await request(server()).get(`${base}/immut`).set("Cookie", owner.cookie);
    expect(detail.status).toBe(200);
    expect(detail.body.flag.key).toBe("immut");
    const renamedGet = await request(server()).get(`${base}/renamed`).set("Cookie", owner.cookie);
    expect(renamedGet.status).toBe(404);
  });

  it("AC7: GET/PATCH unknown flag → 404 LOST_OWL", async () => {
    const owner = await register();
    const { slug } = await makeOrg(owner);
    const projectKey = await makeProject(owner, slug);
    const base = `/api/v1/orgs/${slug}/projects/${projectKey}/flags`;

    const get = await request(server()).get(`${base}/ghost`).set("Cookie", owner.cookie);
    expect(get.status).toBe(404);
    expect(get.body.error.code).toBe("LOST_OWL");

    const patch = await request(server())
      .patch(`${base}/ghost`)
      .set("Cookie", owner.cookie)
      .set("X-CSRF-Token", owner.csrf)
      .send({ archived: true });
    expect(patch.status).toBe(404);
    expect(patch.body.error.code).toBe("LOST_OWL");
  });

  it("AC8: no session cookie → 401 SLEEPY_OWL", async () => {
    const owner = await register();
    const { slug } = await makeOrg(owner);
    const projectKey = await makeProject(owner, slug);
    const res = await request(server()).get(`/api/v1/orgs/${slug}/projects/${projectKey}/flags`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("SLEEPY_OWL");
  });

  it("AC9: mutation without X-CSRF-Token → 403 GRUMPY_OWL", async () => {
    const owner = await register();
    const { slug } = await makeOrg(owner);
    const projectKey = await makeProject(owner, slug);
    const res = await request(server())
      .post(`/api/v1/orgs/${slug}/projects/${projectKey}/flags`)
      .set("Cookie", owner.cookie)
      .send({ key: "no-csrf" });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("GRUMPY_OWL");
  });

  it("AC10: non-member → 403 LONELY_OWL", async () => {
    const owner = await register();
    const { slug } = await makeOrg(owner);
    const projectKey = await makeProject(owner, slug);
    const outsider = await register();
    const res = await request(server())
      .get(`/api/v1/orgs/${slug}/projects/${projectKey}/flags`)
      .set("Cookie", outsider.cookie);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("LONELY_OWL");
  });

  it("AC11: member can GET but not mutate → 403 SNEAKY_OWL on write", async () => {
    const owner = await register();
    const { slug, orgId } = await makeOrg(owner);
    const projectKey = await makeProject(owner, slug);
    const member = await register();
    await sql`
      INSERT INTO memberships (organization_id, user_id, role) VALUES (${orgId}, ${member.id}, 'member')
    `.execute(admin);
    const base = `/api/v1/orgs/${slug}/projects/${projectKey}/flags`;

    const list = await request(server()).get(base).set("Cookie", member.cookie);
    expect(list.status).toBe(200);

    const create = await request(server())
      .post(base)
      .set("Cookie", member.cookie)
      .set("X-CSRF-Token", member.csrf)
      .send({ key: "member-flag" });
    expect(create.status).toBe(403);
    expect(create.body.error.code).toBe("SNEAKY_OWL");
  });

  it("AC12: malformed bodies → 400 CLUMSY_OWL", async () => {
    const owner = await register();
    const { slug } = await makeOrg(owner);
    const projectKey = await makeProject(owner, slug);
    await createFlag(owner, slug, projectKey, { key: "patch-me" }).expect(201);
    const base = `/api/v1/orgs/${slug}/projects/${projectKey}/flags`;

    const emptyPatch = await request(server())
      .patch(`${base}/patch-me`)
      .set("Cookie", owner.cookie)
      .set("X-CSRF-Token", owner.csrf)
      .send({});
    expect(emptyPatch.status).toBe(400);
    expect(emptyPatch.body.error.code).toBe("CLUMSY_OWL");

    const missingKey = await createFlag(owner, slug, projectKey, { description: "no key" });
    expect(missingKey.status).toBe(400);
    expect(missingKey.body.error.code).toBe("CLUMSY_OWL");
  });
});
