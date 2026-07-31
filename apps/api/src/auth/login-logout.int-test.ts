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

function cookieOf(res: request.Response): string {
  const raw = res.headers["set-cookie"];
  const header = Array.isArray(raw) ? raw[0] : String(raw);
  return header.split(";")[0];
}

describe("POST /auth/login + /auth/logout (integration)", () => {
  let app: INestApplication;
  let admin: Kysely<Database>;
  const created: string[] = [];
  const PASSWORD = "correct-horse-42";

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

  /** Register a fresh account and return its email. */
  async function register(): Promise<string> {
    const email = `login-${randomUUID()}@example.com`;
    created.push(email);
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/signup")
      .send({ email, password: PASSWORD, name: "Ada" });
    expect(res.status).toBe(201);
    return email;
  }

  it("valid login → 200 + Set-Cookie + { user, memberships:[], csrfToken }", async () => {
    const email = await register();
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(String(res.headers["set-cookie"])).toContain("togglr_session=");
    expect(res.body).toEqual({
      user: { id: expect.any(String), email, name: "Ada" },
      memberships: [],
      csrfToken: expect.any(String),
    });
  });

  it("wrong password and unknown email → byte-identical 401 SLY_FOX", async () => {
    const email = await register();
    const wrongPw = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password: "not-the-password" });
    const unknown = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: `nobody-${randomUUID()}@example.com`, password: PASSWORD });

    expect(wrongPw.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrongPw.body).toEqual({
      error: { code: "SLY_FOX", message: "Invalid email or password" },
    });
    expect(unknown.body).toEqual(wrongPw.body);
  });

  it("missing email or password → 400 CLUMSY_OWL", async () => {
    const noEmail = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ password: PASSWORD });
    const noPassword = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: "someone@example.com" });
    expect(noEmail.status).toBe(400);
    expect(noEmail.body.error.code).toBe("CLUMSY_OWL");
    expect(noPassword.status).toBe(400);
    expect(noPassword.body.error.code).toBe("CLUMSY_OWL");
  });

  it("logout with session + CSRF → 204, then the same session is 401", async () => {
    const email = await register();
    const login = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password: PASSWORD });
    const cookie = cookieOf(login);
    const csrf = login.body.csrfToken;

    const out = await request(app.getHttpServer())
      .post("/api/v1/auth/logout")
      .set("Cookie", cookie)
      .set("X-CSRF-Token", csrf);
    expect(out.status).toBe(204);

    const after = await request(app.getHttpServer()).get("/api/v1/auth/me").set("Cookie", cookie);
    expect(after.status).toBe(401);
    expect(after.body.error.code).toBe("SLEEPY_OWL");
  });

  it("logout without CSRF → 403 GRUMPY_OWL; without a session → 401 SLEEPY_OWL", async () => {
    const email = await register();
    const login = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password: PASSWORD });
    const cookie = cookieOf(login);

    const noCsrf = await request(app.getHttpServer())
      .post("/api/v1/auth/logout")
      .set("Cookie", cookie);
    expect(noCsrf.status).toBe(403);
    expect(noCsrf.body.error.code).toBe("GRUMPY_OWL");

    const noSession = await request(app.getHttpServer()).post("/api/v1/auth/logout");
    expect(noSession.status).toBe(401);
    expect(noSession.body.error.code).toBe("SLEEPY_OWL");
  });
});
