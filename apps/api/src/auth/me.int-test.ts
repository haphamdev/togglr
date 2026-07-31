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

/** Extract the togglr_session cookie value from a signup Set-Cookie header. */
function sessionCookie(res: request.Response): string {
  const raw = res.headers["set-cookie"];
  const header = Array.isArray(raw) ? raw[0] : String(raw);
  return header.split(";")[0]; // "togglr_session=<token>"
}

describe("GET /auth/me (integration)", () => {
  let app: INestApplication;
  let admin: Kysely<Database>;
  const created: string[] = [];

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
    if (created.length > 0) {
      await sql`DELETE FROM users WHERE email = ANY(${created})`.execute(admin);
    }
    await admin.destroy();
    await app.close();
  });

  async function signup(): Promise<{ cookie: string; csrfToken: string; email: string }> {
    const email = `me-${randomUUID()}@example.com`;
    created.push(email);
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/signup")
      .send({ email, password: "correct-horse", name: "Grace" });
    expect(res.status).toBe(201);
    return { cookie: sessionCookie(res), csrfToken: res.body.csrfToken, email };
  }

  it("returns 200 { user, memberships:[], csrfToken } with a valid session cookie", async () => {
    const { cookie, csrfToken, email } = await signup();
    const res = await request(app.getHttpServer()).get("/api/v1/auth/me").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      user: { id: expect.any(String), email, name: "Grace" },
      memberships: [],
      csrfToken,
    });
  });

  it("never requires CSRF on the GET (no X-CSRF-Token still 200)", async () => {
    const { cookie } = await signup();
    const res = await request(app.getHttpServer()).get("/api/v1/auth/me").set("Cookie", cookie);
    expect(res.status).toBe(200);
  });

  it("returns 401 SLEEPY_OWL without a session cookie", async () => {
    const res = await request(app.getHttpServer()).get("/api/v1/auth/me");
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { code: "SLEEPY_OWL", message: expect.any(String) } });
  });

  it("still accepts the bootstrap signup POST with no CSRF token (Public)", async () => {
    const email = `me-boot-${randomUUID()}@example.com`;
    created.push(email);
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/signup")
      .send({ email, password: "correct-horse" });
    expect(res.status).toBe(201);
  });

  it("leaves /healthz unauthenticated (200, own body)", async () => {
    const res = await request(app.getHttpServer()).get("/healthz");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", checks: { postgres: true, redis: true } });
  });
});
