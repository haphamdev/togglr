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

describe("Organizations (integration)", () => {
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
    if (slugs.length > 0) {
      await sql`DELETE FROM organizations WHERE slug = ANY(${slugs})`.execute(admin);
    }
    if (emails.length > 0) {
      await sql`DELETE FROM users WHERE email = ANY(${emails})`.execute(admin);
    }
    await admin.destroy();
    await app.close();
  });

  function server() {
    return app.getHttpServer();
  }

  async function register(): Promise<User> {
    const email = `org-${randomUUID()}@example.com`;
    emails.push(email);
    const res = await request(server())
      .post("/api/v1/auth/signup")
      .send({ email, password: PASSWORD, name: "Ada" });
    expect(res.status).toBe(201);
    return { cookie: cookieOf(res), csrf: res.body.csrfToken, email, id: res.body.user.id };
  }

  function freshSlug(prefix: string): string {
    const slug = `${prefix}-${randomUUID().slice(0, 8)}`;
    slugs.push(slug);
    return slug;
  }

  function createOrg(u: User, slug: string, name: string) {
    return request(server())
      .post("/api/v1/orgs")
      .set("Cookie", u.cookie)
      .set("X-CSRF-Token", u.csrf)
      .send({ name, slug });
  }

  async function orgIdOf(slug: string): Promise<string> {
    const r = await sql<{ id: string }>`SELECT id FROM organizations WHERE slug = ${slug}`.execute(
      admin,
    );
    return r.rows[0].id;
  }

  it("creates an org (201, caller owner); lists it; surfaces it on /auth/me", async () => {
    const u = await register();
    const slug = freshSlug("acme");
    const res = await createOrg(u, slug, "Acme Inc");
    expect(res.status).toBe(201);
    expect(res.body.org).toEqual({
      slug,
      name: "Acme Inc",
      role: "owner",
      createdAt: expect.any(String),
    });

    const list = await request(server()).get("/api/v1/orgs").set("Cookie", u.cookie);
    expect(list.status).toBe(200);
    expect(list.body.orgs).toContainEqual({
      slug,
      name: "Acme Inc",
      role: "owner",
      createdAt: expect.any(String),
    });

    const me = await request(server()).get("/api/v1/auth/me").set("Cookie", u.cookie);
    expect(me.status).toBe(200);
    expect(me.body.memberships).toContainEqual({ slug, name: "Acme Inc", role: "owner" });
  });

  it("rejects a duplicate slug with 409 FUNNY_PIG", async () => {
    const u = await register();
    const slug = freshSlug("dup");
    expect((await createOrg(u, slug, "One")).status).toBe(201);
    const res = await createOrg(u, slug, "Two");
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("FUNNY_PIG");
  });

  it("rejects a malformed slug or missing name with 400 CLUMSY_OWL", async () => {
    const u = await register();
    const bad = await request(server())
      .post("/api/v1/orgs")
      .set("Cookie", u.cookie)
      .set("X-CSRF-Token", u.csrf)
      .send({ name: "X", slug: "Bad Slug" });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe("CLUMSY_OWL");

    const noName = await request(server())
      .post("/api/v1/orgs")
      .set("Cookie", u.cookie)
      .set("X-CSRF-Token", u.csrf)
      .send({ slug: freshSlug("noname") });
    expect(noName.status).toBe(400);
    expect(noName.body.error.code).toBe("CLUMSY_OWL");
  });

  it("GET /orgs/:slug: member 200, non-member LONELY_OWL, unknown LOST_OWL", async () => {
    const owner = await register();
    const slug = freshSlug("view");
    await createOrg(owner, slug, "Viewable");

    const asMember = await request(server())
      .get(`/api/v1/orgs/${slug}`)
      .set("Cookie", owner.cookie);
    expect(asMember.status).toBe(200);
    expect(asMember.body.org).toEqual({
      slug,
      name: "Viewable",
      role: "owner",
      createdAt: expect.any(String),
    });

    const stranger = await register();
    const asNonMember = await request(server())
      .get(`/api/v1/orgs/${slug}`)
      .set("Cookie", stranger.cookie);
    expect(asNonMember.status).toBe(403);
    expect(asNonMember.body.error.code).toBe("LONELY_OWL");

    const unknown = await request(server())
      .get(`/api/v1/orgs/nope-${randomUUID().slice(0, 8)}`)
      .set("Cookie", owner.cookie);
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe("LOST_OWL");
  });

  it("PATCH: owner renames (200, slug immutable); admin gets SNEAKY_OWL", async () => {
    const owner = await register();
    const slug = freshSlug("rename");
    await createOrg(owner, slug, "Before");
    const orgId = await orgIdOf(slug);

    const renamed = await request(server())
      .patch(`/api/v1/orgs/${slug}`)
      .set("Cookie", owner.cookie)
      .set("X-CSRF-Token", owner.csrf)
      .send({ name: "After" });
    expect(renamed.status).toBe(200);
    expect(renamed.body.org).toEqual({
      slug,
      name: "After",
      role: "owner",
      createdAt: expect.any(String),
    });

    // Seed a second user as an admin of the org, then confirm rename is owner-only.
    const adminUser = await register();
    await sql`
      INSERT INTO memberships (organization_id, user_id, role)
      VALUES (${orgId}, ${adminUser.id}, 'admin')
    `.execute(admin);
    const denied = await request(server())
      .patch(`/api/v1/orgs/${slug}`)
      .set("Cookie", adminUser.cookie)
      .set("X-CSRF-Token", adminUser.csrf)
      .send({ name: "Nope" });
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe("SNEAKY_OWL");
  });

  it("mutations without CSRF → GRUMPY_OWL; without a session → SLEEPY_OWL", async () => {
    const u = await register();
    const noCsrf = await request(server())
      .post("/api/v1/orgs")
      .set("Cookie", u.cookie)
      .send({ name: "X", slug: freshSlug("nocsrf") });
    expect(noCsrf.status).toBe(403);
    expect(noCsrf.body.error.code).toBe("GRUMPY_OWL");

    const noSession = await request(server())
      .post("/api/v1/orgs")
      .send({ name: "X", slug: freshSlug("nosess") });
    expect(noSession.status).toBe(401);
    expect(noSession.body.error.code).toBe("SLEEPY_OWL");
  });
});
