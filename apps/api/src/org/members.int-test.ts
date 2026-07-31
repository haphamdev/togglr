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

describe("Members & roles (integration)", () => {
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
    const email = `mem-${randomUUID()}@example.com`;
    emails.push(email);
    const res = await request(server())
      .post("/api/v1/auth/signup")
      .send({ email, password: PASSWORD, name: "Ada" });
    expect(res.status).toBe(201);
    return { cookie: cookieOf(res), csrf: res.body.csrfToken, email, id: res.body.user.id };
  }

  /** Create an org owned by `u`; returns { slug, orgId }. */
  async function makeOrg(u: User): Promise<{ slug: string; orgId: string }> {
    const slug = `mem-${randomUUID().slice(0, 8)}`;
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

  async function seedMember(orgId: string, userId: string, role: string): Promise<void> {
    await sql`
      INSERT INTO memberships (organization_id, user_id, role) VALUES (${orgId}, ${userId}, ${role})
    `.execute(admin);
  }

  it("lists members; owner promotes then demotes another member", async () => {
    const owner = await register();
    const { slug, orgId } = await makeOrg(owner);
    const member = await register();
    await seedMember(orgId, member.id, "member");

    const list = await request(server())
      .get(`/api/v1/orgs/${slug}/members`)
      .set("Cookie", owner.cookie);
    expect(list.status).toBe(200);
    expect(list.body.members).toHaveLength(2);
    expect(list.body.members).toContainEqual({
      userId: member.id,
      email: member.email,
      name: "Ada",
      role: "member",
      createdAt: expect.any(String),
    });

    const promote = await request(server())
      .patch(`/api/v1/orgs/${slug}/members/${member.id}`)
      .set("Cookie", owner.cookie)
      .set("X-CSRF-Token", owner.csrf)
      .send({ role: "admin" });
    expect(promote.status).toBe(200);
    expect(promote.body.member.role).toBe("admin");

    const demote = await request(server())
      .patch(`/api/v1/orgs/${slug}/members/${member.id}`)
      .set("Cookie", owner.cookie)
      .set("X-CSRF-Token", owner.csrf)
      .send({ role: "member" });
    expect(demote.status).toBe(200);
    expect(demote.body.member.role).toBe("member");
  });

  it("blocks demoting the only owner with 409 LONELY_RAM", async () => {
    const owner = await register();
    const { slug } = await makeOrg(owner);
    const res = await request(server())
      .patch(`/api/v1/orgs/${slug}/members/${owner.id}`)
      .set("Cookie", owner.cookie)
      .set("X-CSRF-Token", owner.csrf)
      .send({ role: "admin" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("LONELY_RAM");
  });

  it("rejects a role change by a non-owner with 403 SNEAKY_OWL", async () => {
    const owner = await register();
    const { slug, orgId } = await makeOrg(owner);
    const adminUser = await register();
    await seedMember(orgId, adminUser.id, "admin");
    const res = await request(server())
      .patch(`/api/v1/orgs/${slug}/members/${owner.id}`)
      .set("Cookie", adminUser.cookie)
      .set("X-CSRF-Token", adminUser.csrf)
      .send({ role: "member" });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("SNEAKY_OWL");
  });

  it("returns 404 LOST_OWL for an unknown member id", async () => {
    const owner = await register();
    const { slug } = await makeOrg(owner);
    const res = await request(server())
      .patch(`/api/v1/orgs/${slug}/members/${randomUUID()}`)
      .set("Cookie", owner.cookie)
      .set("X-CSRF-Token", owner.csrf)
      .send({ role: "admin" });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("LOST_OWL");
  });

  it("returns 400 CLUMSY_OWL for an invalid role value", async () => {
    const owner = await register();
    const { slug } = await makeOrg(owner);
    const res = await request(server())
      .patch(`/api/v1/orgs/${slug}/members/${owner.id}`)
      .set("Cookie", owner.cookie)
      .set("X-CSRF-Token", owner.csrf)
      .send({ role: "superuser" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("CLUMSY_OWL");
  });

  it("removes a member (204) then it is absent; blocks removing the only owner", async () => {
    const owner = await register();
    const { slug, orgId } = await makeOrg(owner);
    const member = await register();
    await seedMember(orgId, member.id, "member");

    const del = await request(server())
      .delete(`/api/v1/orgs/${slug}/members/${member.id}`)
      .set("Cookie", owner.cookie)
      .set("X-CSRF-Token", owner.csrf);
    expect(del.status).toBe(204);

    const list = await request(server())
      .get(`/api/v1/orgs/${slug}/members`)
      .set("Cookie", owner.cookie);
    expect(list.body.members).toHaveLength(1);
    expect(list.body.members[0].userId).toBe(owner.id);

    const removeOwner = await request(server())
      .delete(`/api/v1/orgs/${slug}/members/${owner.id}`)
      .set("Cookie", owner.cookie)
      .set("X-CSRF-Token", owner.csrf);
    expect(removeOwner.status).toBe(409);
    expect(removeOwner.body.error.code).toBe("LONELY_RAM");
  });
});
