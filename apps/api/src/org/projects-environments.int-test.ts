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

describe("Projects & environments (integration)", () => {
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
    const email = `pe-${randomUUID()}@example.com`;
    emails.push(email);
    const res = await request(server())
      .post("/api/v1/auth/signup")
      .send({ email, password: PASSWORD, name: "Ada" });
    expect(res.status).toBe(201);
    return { cookie: cookieOf(res), csrf: res.body.csrfToken, email, id: res.body.user.id };
  }

  async function makeOrg(u: User): Promise<{ slug: string; orgId: string }> {
    const slug = `pe-${randomUUID().slice(0, 8)}`;
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

  function createProject(u: User, slug: string, key: string, name = "Proj") {
    return request(server())
      .post(`/api/v1/orgs/${slug}/projects`)
      .set("Cookie", u.cookie)
      .set("X-CSRF-Token", u.csrf)
      .send({ key, name });
  }

  it("creates a project with three seeded envs at version 0; dup key → SLEEPY_DOG", async () => {
    const owner = await register();
    const { slug } = await makeOrg(owner);
    const key = `checkout-${randomUUID().slice(0, 6)}`;
    const res = await createProject(owner, slug, key, "Checkout");
    expect(res.status).toBe(201);
    expect(res.body.project).toEqual({ key, name: "Checkout", createdAt: expect.any(String) });
    expect(res.body.environments).toEqual([
      {
        key: "development",
        name: "Development",
        rulesetVersion: 0,
        archivedAt: null,
        createdAt: expect.any(String),
      },
      {
        key: "staging",
        name: "Staging",
        rulesetVersion: 0,
        archivedAt: null,
        createdAt: expect.any(String),
      },
      {
        key: "production",
        name: "Production",
        rulesetVersion: 0,
        archivedAt: null,
        createdAt: expect.any(String),
      },
    ]);

    const dup = await createProject(owner, slug, key, "Again");
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe("SLEEPY_DOG");
  });

  it("rejects a malformed project key with CLUMSY_OWL and a member create with SNEAKY_OWL", async () => {
    const owner = await register();
    const { slug, orgId } = await makeOrg(owner);

    const bad = await createProject(owner, slug, "Bad Key", "X");
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe("CLUMSY_OWL");

    const member = await register();
    await sql`
      INSERT INTO memberships (organization_id, user_id, role) VALUES (${orgId}, ${member.id}, 'member')
    `.execute(admin);
    const denied = await createProject(member, slug, `p-${randomUUID().slice(0, 6)}`, "X");
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe("SNEAKY_OWL");
  });

  it("lists/detail/renames projects; unknown project → LOST_OWL", async () => {
    const owner = await register();
    const { slug } = await makeOrg(owner);
    const key = `svc-${randomUUID().slice(0, 6)}`;
    await createProject(owner, slug, key, "Service");

    const list = await request(server())
      .get(`/api/v1/orgs/${slug}/projects`)
      .set("Cookie", owner.cookie);
    expect(list.status).toBe(200);
    expect(list.body.projects).toContainEqual({
      key,
      name: "Service",
      createdAt: expect.any(String),
    });

    const detail = await request(server())
      .get(`/api/v1/orgs/${slug}/projects/${key}`)
      .set("Cookie", owner.cookie);
    expect(detail.status).toBe(200);
    expect(detail.body.project.name).toBe("Service");

    const renamed = await request(server())
      .patch(`/api/v1/orgs/${slug}/projects/${key}`)
      .set("Cookie", owner.cookie)
      .set("X-CSRF-Token", owner.csrf)
      .send({ name: "Service v2" });
    expect(renamed.status).toBe(200);
    expect(renamed.body.project).toEqual({
      key,
      name: "Service v2",
      createdAt: expect.any(String),
    });

    const unknown = await request(server())
      .get(`/api/v1/orgs/${slug}/projects/does-not-exist`)
      .set("Cookie", owner.cookie);
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe("LOST_OWL");
  });

  it("adds a custom env (additive), dup env key → NOISY_DUCK, list/detail/rename, unknown → LOST_OWL", async () => {
    const owner = await register();
    const { slug } = await makeOrg(owner);
    const projectKey = `app-${randomUUID().slice(0, 6)}`;
    await createProject(owner, slug, projectKey, "App");
    const base = `/api/v1/orgs/${slug}/projects/${projectKey}/environments`;

    const created = await request(server())
      .post(base)
      .set("Cookie", owner.cookie)
      .set("X-CSRF-Token", owner.csrf)
      .send({ key: "canary", name: "Canary" });
    expect(created.status).toBe(201);
    expect(created.body.environment).toEqual({
      key: "canary",
      name: "Canary",
      rulesetVersion: 0,
      archivedAt: null,
      createdAt: expect.any(String),
    });

    // Additive: the three seeded envs plus the custom one.
    const list = await request(server()).get(base).set("Cookie", owner.cookie);
    expect(list.status).toBe(200);
    expect(list.body.environments.map((e: { key: string }) => e.key)).toEqual([
      "development",
      "staging",
      "production",
      "canary",
    ]);

    const dup = await request(server())
      .post(base)
      .set("Cookie", owner.cookie)
      .set("X-CSRF-Token", owner.csrf)
      .send({ key: "canary", name: "Canary 2" });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe("NOISY_DUCK");

    const detail = await request(server()).get(`${base}/production`).set("Cookie", owner.cookie);
    expect(detail.status).toBe(200);
    expect(detail.body.environment).toEqual({
      key: "production",
      name: "Production",
      rulesetVersion: 0,
      archivedAt: null,
      createdAt: expect.any(String),
    });

    const renamed = await request(server())
      .patch(`${base}/canary`)
      .set("Cookie", owner.cookie)
      .set("X-CSRF-Token", owner.csrf)
      .send({ name: "Canary (EU)" });
    expect(renamed.status).toBe(200);
    expect(renamed.body.environment.name).toBe("Canary (EU)");

    const unknownEnv = await request(server()).get(`${base}/nope`).set("Cookie", owner.cookie);
    expect(unknownEnv.status).toBe(404);
    expect(unknownEnv.body.error.code).toBe("LOST_OWL");

    const unknownProjectEnvs = await request(server())
      .get(`/api/v1/orgs/${slug}/projects/ghost/environments`)
      .set("Cookie", owner.cookie);
    expect(unknownProjectEnvs.status).toBe(404);
    expect(unknownProjectEnvs.body.error.code).toBe("LOST_OWL");
  });

  it("archives/restores an env, still renames, empty body → CLUMSY_OWL, member → SNEAKY_OWL, unknown → LOST_OWL", async () => {
    const owner = await register();
    const { slug, orgId } = await makeOrg(owner);
    const projectKey = `arc-${randomUUID().slice(0, 6)}`;
    await createProject(owner, slug, projectKey, "Arc");
    const base = `/api/v1/orgs/${slug}/projects/${projectKey}/environments`;

    await request(server())
      .post(base)
      .set("Cookie", owner.cookie)
      .set("X-CSRF-Token", owner.csrf)
      .send({ key: "canary", name: "Canary" })
      .expect(201);

    // Archive: sets archivedAt; list still returns it (client filters).
    const archived = await request(server())
      .patch(`${base}/canary`)
      .set("Cookie", owner.cookie)
      .set("X-CSRF-Token", owner.csrf)
      .send({ archived: true });
    expect(archived.status).toBe(200);
    expect(archived.body.environment.archivedAt).toEqual(expect.any(String));

    const list = await request(server()).get(base).set("Cookie", owner.cookie);
    const canaryRow = list.body.environments.find((e: { key: string }) => e.key === "canary");
    expect(canaryRow.archivedAt).toEqual(expect.any(String));

    // Restore: clears archivedAt.
    const restored = await request(server())
      .patch(`${base}/canary`)
      .set("Cookie", owner.cookie)
      .set("X-CSRF-Token", owner.csrf)
      .send({ archived: false });
    expect(restored.status).toBe(200);
    expect(restored.body.environment.archivedAt).toBeNull();

    // Rename still works and leaves archivedAt untouched.
    const renamed = await request(server())
      .patch(`${base}/canary`)
      .set("Cookie", owner.cookie)
      .set("X-CSRF-Token", owner.csrf)
      .send({ name: "Canary (EU)" });
    expect(renamed.status).toBe(200);
    expect(renamed.body.environment.name).toBe("Canary (EU)");
    expect(renamed.body.environment.archivedAt).toBeNull();

    // Empty body → CLUMSY_OWL.
    const empty = await request(server())
      .patch(`${base}/canary`)
      .set("Cookie", owner.cookie)
      .set("X-CSRF-Token", owner.csrf)
      .send({});
    expect(empty.status).toBe(400);
    expect(empty.body.error.code).toBe("CLUMSY_OWL");

    // Member cannot archive → SNEAKY_OWL.
    const member = await register();
    await sql`
      INSERT INTO memberships (organization_id, user_id, role) VALUES (${orgId}, ${member.id}, 'member')
    `.execute(admin);
    const denied = await request(server())
      .patch(`${base}/canary`)
      .set("Cookie", member.cookie)
      .set("X-CSRF-Token", member.csrf)
      .send({ archived: true });
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe("SNEAKY_OWL");

    // Unknown env → LOST_OWL.
    const unknown = await request(server())
      .patch(`${base}/nope`)
      .set("Cookie", owner.cookie)
      .set("X-CSRF-Token", owner.csrf)
      .send({ archived: true });
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe("LOST_OWL");
  });
});
