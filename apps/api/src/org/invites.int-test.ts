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
const MAILHOG = `http://localhost:${process.env.MAILHOG_UI_PORT ?? "8025"}`;

function cookieOf(res: request.Response): string {
  const raw = res.headers["set-cookie"];
  const header = Array.isArray(raw) ? raw[0] : String(raw);
  return header.split(";")[0];
}

/** Fetch the raw bodies of Mailhog messages addressed to `email`. */
async function mailhogBodiesFor(email: string): Promise<string[]> {
  const res = await fetch(`${MAILHOG}/api/v2/search?kind=to&query=${encodeURIComponent(email)}`);
  const data = (await res.json()) as { items: Array<{ Content: { Body: string } }> };
  return data.items.map((i) => i.Content.Body);
}

/** Extract the invite token from an email body (undo quoted-printable soft breaks). */
function extractToken(raw: string): string | null {
  const cleaned = raw.replace(/=\r?\n/g, "");
  const m = cleaned.match(/\/invite\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

interface User {
  cookie: string;
  csrf: string;
  email: string;
  id: string;
}

describe("Invites — org side (integration)", () => {
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
    const email = `inv-${randomUUID()}@example.com`;
    emails.push(email);
    const res = await request(server())
      .post("/api/v1/auth/signup")
      .send({ email, password: PASSWORD, name: "Ada" });
    expect(res.status).toBe(201);
    return { cookie: cookieOf(res), csrf: res.body.csrfToken, email, id: res.body.user.id };
  }

  async function makeOrg(u: User): Promise<{ slug: string; orgId: string }> {
    const slug = `inv-${randomUUID().slice(0, 8)}`;
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

  function invite(u: User, slug: string, email: string, role = "admin") {
    return request(server())
      .post(`/api/v1/orgs/${slug}/invites`)
      .set("Cookie", u.cookie)
      .set("X-CSRF-Token", u.csrf)
      .send({ email, role });
  }

  const inviteeEmail = () => `invitee-${randomUUID()}@example.com`;

  it("creates a pending 7-day invite, emails a link (Mailhog), and preview resolves it", async () => {
    const owner = await register();
    const { slug } = await makeOrg(owner);
    const email = inviteeEmail();

    const res = await invite(owner, slug, email, "admin");
    expect(res.status).toBe(201);
    expect(res.body.invite).toEqual({
      id: expect.any(String),
      email,
      role: "admin",
      status: "pending",
      expiresAt: expect.any(String),
      createdAt: expect.any(String),
    });
    const days = (Date.parse(res.body.invite.expiresAt) - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.5);
    expect(days).toBeLessThan(7.5);

    const bodies = await mailhogBodiesFor(email);
    expect(bodies.length).toBeGreaterThan(0);
    const token = extractToken(bodies[0]);
    expect(token).toBeTruthy();

    const preview = await request(server()).get(`/api/v1/auth/invites/${token}`);
    expect(preview.status).toBe(200);
    expect(preview.body).toEqual({
      orgName: "Team",
      email,
      role: "admin",
      userExists: false,
      expiresAt: expect.any(String),
    });
  });

  it("rejects inviting an existing member (COZY_BEE) and a duplicate pending invite (BUSY_BEE)", async () => {
    const owner = await register();
    const { slug } = await makeOrg(owner);

    const asMember = await invite(owner, slug, owner.email, "member");
    expect(asMember.status).toBe(409);
    expect(asMember.body.error.code).toBe("COZY_BEE");

    const email = inviteeEmail();
    expect((await invite(owner, slug, email, "admin")).status).toBe(201);
    const dup = await invite(owner, slug, email, "admin");
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe("BUSY_BEE");
  });

  it("rejects a member creating an invite with SNEAKY_OWL", async () => {
    const owner = await register();
    const { slug, orgId } = await makeOrg(owner);
    const member = await register();
    await sql`
      INSERT INTO memberships (organization_id, user_id, role) VALUES (${orgId}, ${member.id}, 'member')
    `.execute(admin);
    const res = await invite(member, slug, inviteeEmail(), "admin");
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("SNEAKY_OWL");
  });

  it("resend regenerates the token (old one → LOST_BEE), lists it, then revoke → 204", async () => {
    const owner = await register();
    const { slug } = await makeOrg(owner);
    const email = inviteeEmail();

    const created = await invite(owner, slug, email, "member");
    expect(created.status).toBe(201);
    const inviteId = created.body.invite.id;
    const firstToken = extractToken((await mailhogBodiesFor(email))[0]);
    expect(firstToken).toBeTruthy();

    const resent = await request(server())
      .post(`/api/v1/orgs/${slug}/invites/${inviteId}/resend`)
      .set("Cookie", owner.cookie)
      .set("X-CSRF-Token", owner.csrf);
    expect(resent.status).toBe(200);

    const bodies = await mailhogBodiesFor(email);
    const tokens = bodies.map(extractToken).filter(Boolean) as string[];
    const secondToken = tokens.find((t) => t !== firstToken);
    expect(secondToken).toBeTruthy();

    // Old token is invalidated; new token resolves.
    const oldPreview = await request(server()).get(`/api/v1/auth/invites/${firstToken}`);
    expect(oldPreview.status).toBe(404);
    expect(oldPreview.body.error.code).toBe("LOST_BEE");
    const newPreview = await request(server()).get(`/api/v1/auth/invites/${secondToken}`);
    expect(newPreview.status).toBe(200);

    const list = await request(server())
      .get(`/api/v1/orgs/${slug}/invites`)
      .set("Cookie", owner.cookie);
    expect(list.status).toBe(200);
    expect(list.body.invites).toContainEqual(
      expect.objectContaining({ id: inviteId, email, status: "pending" }),
    );

    const del = await request(server())
      .delete(`/api/v1/orgs/${slug}/invites/${inviteId}`)
      .set("Cookie", owner.cookie)
      .set("X-CSRF-Token", owner.csrf);
    expect(del.status).toBe(204);

    // Revoked invite can no longer be resolved.
    const gone = await request(server()).get(`/api/v1/auth/invites/${secondToken}`);
    expect(gone.status).toBe(404);
    expect(gone.body.error.code).toBe("LOST_BEE");
  });

  it("resend of an unknown invite → LOST_OWL", async () => {
    const owner = await register();
    const { slug } = await makeOrg(owner);
    const res = await request(server())
      .post(`/api/v1/orgs/${slug}/invites/${randomUUID()}/resend`)
      .set("Cookie", owner.cookie)
      .set("X-CSRF-Token", owner.csrf);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("LOST_OWL");
  });
});
