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

async function tokenFor(email: string): Promise<string> {
  const res = await fetch(`${MAILHOG}/api/v2/search?kind=to&query=${encodeURIComponent(email)}`);
  const data = (await res.json()) as { items: Array<{ Content: { Body: string } }> };
  for (const item of data.items) {
    const m = item.Content.Body.replace(/=\r?\n/g, "").match(/\/invite\/([A-Za-z0-9_-]+)/);
    if (m) return m[1];
  }
  throw new Error(`no invite token found in Mailhog for ${email}`);
}

interface User {
  cookie: string;
  csrf: string;
  email: string;
  id: string;
}

describe("Invite accept — auth side (integration)", () => {
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
    const email = `acc-${randomUUID()}@example.com`;
    emails.push(email);
    const res = await request(server())
      .post("/api/v1/auth/signup")
      .send({ email, password: PASSWORD, name: "Ada" });
    expect(res.status).toBe(201);
    return { cookie: cookieOf(res), csrf: res.body.csrfToken, email, id: res.body.user.id };
  }

  async function makeOrg(u: User): Promise<string> {
    const slug = `acc-${randomUUID().slice(0, 8)}`;
    slugs.push(slug);
    const res = await request(server())
      .post("/api/v1/orgs")
      .set("Cookie", u.cookie)
      .set("X-CSRF-Token", u.csrf)
      .send({ name: "Team", slug });
    expect(res.status).toBe(201);
    return slug;
  }

  /** Invite `email` at `role` and return { inviteId, token }. */
  async function invite(
    owner: User,
    slug: string,
    email: string,
    role = "admin",
  ): Promise<{ inviteId: string; token: string }> {
    const res = await request(server())
      .post(`/api/v1/orgs/${slug}/invites`)
      .set("Cookie", owner.cookie)
      .set("X-CSRF-Token", owner.csrf)
      .send({ email, role });
    expect(res.status).toBe(201);
    return { inviteId: res.body.invite.id, token: await tokenFor(email) };
  }

  const inviteeEmail = () => {
    const email = `newacc-${randomUUID()}@example.com`;
    emails.push(email);
    return email;
  };

  it("new-account accept (no session, with password) → 201 + session + membership; then consumed", async () => {
    const owner = await register();
    const slug = await makeOrg(owner);
    const email = inviteeEmail();
    const { token } = await invite(owner, slug, email, "admin");

    const res = await request(server())
      .post(`/api/v1/auth/invites/${token}/accept`)
      .send({ password: PASSWORD, name: "Grace" });
    expect(res.status).toBe(201);
    expect(String(res.headers["set-cookie"])).toContain("togglr_session=");
    expect(res.body.user).toEqual({ id: expect.any(String), email });
    expect(res.body.membership).toEqual({ slug, role: "admin" });
    expect(res.body.csrfToken).toEqual(expect.any(String));

    // The membership is live on the new session.
    const me = await request(server()).get("/api/v1/auth/me").set("Cookie", cookieOf(res));
    expect(me.status).toBe(200);
    expect(me.body.memberships).toContainEqual({ slug, name: "Team", role: "admin" });

    // Invite is now consumed.
    const preview = await request(server()).get(`/api/v1/auth/invites/${token}`);
    expect(preview.status).toBe(409);
    expect(preview.body.error.code).toBe("HAPPY_BEE");
    const again = await request(server())
      .post(`/api/v1/auth/invites/${token}/accept`)
      .send({ password: PASSWORD });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("HAPPY_BEE");
  });

  it("new-account accept without a password → 400 SHY_FOX", async () => {
    const owner = await register();
    const slug = await makeOrg(owner);
    const email = inviteeEmail();
    const { token } = await invite(owner, slug, email, "member");
    const res = await request(server()).post(`/api/v1/auth/invites/${token}/accept`).send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("SHY_FOX");
  });

  it("existing-account accept (session + CSRF) → 200; mismatched session → PUZZLED_FOX", async () => {
    const owner = await register();
    const slug = await makeOrg(owner);
    const invitee = await register(); // already has an account
    const { token } = await invite(owner, slug, invitee.email, "member");

    // Wrong session (owner, not the invitee) → PUZZLED_FOX.
    const wrong = await request(server())
      .post(`/api/v1/auth/invites/${token}/accept`)
      .set("Cookie", owner.cookie)
      .set("X-CSRF-Token", owner.csrf)
      .send({});
    expect(wrong.status).toBe(403);
    expect(wrong.body.error.code).toBe("PUZZLED_FOX");

    // Correct session (the invitee) → 200 link.
    const ok = await request(server())
      .post(`/api/v1/auth/invites/${token}/accept`)
      .set("Cookie", invitee.cookie)
      .set("X-CSRF-Token", invitee.csrf)
      .send({});
    expect(ok.status).toBe(200);
    expect(ok.body.user).toEqual({ id: invitee.id, email: invitee.email });
    expect(ok.body.membership).toEqual({ slug, role: "member" });

    const me = await request(server()).get("/api/v1/auth/me").set("Cookie", invitee.cookie);
    expect(me.body.memberships).toContainEqual({ slug, name: "Team", role: "member" });
  });

  it("unknown token → LOST_BEE; expired invite → TIRED_BEE", async () => {
    const unknown = await request(server()).get(
      `/api/v1/auth/invites/nope-${randomUUID().slice(0, 8)}`,
    );
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe("LOST_BEE");

    const owner = await register();
    const slug = await makeOrg(owner);
    const email = inviteeEmail();
    const { inviteId, token } = await invite(owner, slug, email, "member");
    await sql`UPDATE invites SET expires_at = now() - interval '1 day' WHERE id = ${inviteId}`.execute(
      admin,
    );

    const preview = await request(server()).get(`/api/v1/auth/invites/${token}`);
    expect(preview.status).toBe(410);
    expect(preview.body.error.code).toBe("TIRED_BEE");
    const accept = await request(server())
      .post(`/api/v1/auth/invites/${token}/accept`)
      .send({ password: PASSWORD });
    expect(accept.status).toBe(410);
    expect(accept.body.error.code).toBe("TIRED_BEE");
  });
});
