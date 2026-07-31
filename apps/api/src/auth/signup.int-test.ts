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

const SIGNUP = "/api/v1/auth/signup";

/** Unique email per run so repeated integration runs don't collide. */
function freshEmail(): string {
  return `signup-${randomUUID()}@example.com`;
}

describe("POST /auth/signup (integration)", () => {
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

  it("creates the user: 201 + Set-Cookie + { user, csrfToken }, no password in the body", async () => {
    const email = freshEmail();
    created.push(email);
    const res = await request(app.getHttpServer())
      .post(SIGNUP)
      .send({ email, password: "correct-horse", name: "Ada" });

    expect(res.status).toBe(201);
    const setCookie = res.headers["set-cookie"];
    expect(String(setCookie)).toContain("togglr_session=");
    expect(String(setCookie)).toContain("HttpOnly");
    expect(res.body.user).toEqual({ id: expect.any(String), email, name: "Ada" });
    expect(typeof res.body.csrfToken).toBe("string");
    expect(res.body.csrfToken.length).toBeGreaterThan(0);
    expect(JSON.stringify(res.body)).not.toContain("password");
    expect(JSON.stringify(res.body)).not.toContain("argon2");
  });

  it("lowercases the email and rejects a case-insensitive duplicate with 409 GREEDY_FOX", async () => {
    const email = `Dup-${randomUUID()}@Example.com`;
    created.push(email.toLowerCase());
    const first = await request(app.getHttpServer())
      .post(SIGNUP)
      .send({ email, password: "correct-horse" });
    expect(first.status).toBe(201);

    const dup = await request(app.getHttpServer())
      .post(SIGNUP)
      .send({ email: email.toUpperCase(), password: "another-password" });
    expect(dup.status).toBe(409);
    expect(dup.body).toEqual({ error: { code: "GREEDY_FOX", message: expect.any(String) } });
  });

  it("rejects a 9-char password with 400 CLUMSY_OWL, accepts 10 chars", async () => {
    const short = await request(app.getHttpServer())
      .post(SIGNUP)
      .send({ email: freshEmail(), password: "123456789" });
    expect(short.status).toBe(400);
    expect(short.body.error.code).toBe("CLUMSY_OWL");

    const email = freshEmail();
    created.push(email);
    const ok = await request(app.getHttpServer())
      .post(SIGNUP)
      .send({ email, password: "1234567890" });
    expect(ok.status).toBe(201);
  });

  it("rejects a missing email or password with 400, accepts a missing name", async () => {
    const noEmail = await request(app.getHttpServer())
      .post(SIGNUP)
      .send({ password: "correct-horse" });
    expect(noEmail.status).toBe(400);

    const noPassword = await request(app.getHttpServer())
      .post(SIGNUP)
      .send({ email: freshEmail() });
    expect(noPassword.status).toBe(400);

    const email = freshEmail();
    created.push(email);
    const noName = await request(app.getHttpServer())
      .post(SIGNUP)
      .send({ email, password: "correct-horse" });
    expect(noName.status).toBe(201);
    expect(noName.body.user.name).toBeNull();
  });

  it("leaves /healthz unprefixed and returning its own 200 body (not the error envelope)", async () => {
    const res = await request(app.getHttpServer()).get("/healthz");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", checks: { postgres: true, redis: true } });
  });
});
