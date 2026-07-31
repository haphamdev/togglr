import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import Redis from "ioredis";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../app.module";
import { configureApp } from "../bootstrap/configure-app";
import type { Database } from "../db/database";
import type { SessionRecord } from "./session.service";

const COOKIE_PREFIX = "togglr_session=";

function cookieOf(res: request.Response): string {
  const raw = res.headers["set-cookie"];
  const header = Array.isArray(raw) ? raw[0] : String(raw);
  return header.split(";")[0];
}

function tokenOf(cookie: string): string {
  return cookie.slice(COOKIE_PREFIX.length);
}

describe("POST /auth/logout-all + TTL enforcement (integration)", () => {
  let app: INestApplication;
  let admin: Kysely<Database>;
  let redis: Redis;
  const created: string[] = [];
  const PASSWORD = "correct-horse-99";

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
    redis = new Redis(process.env.REDIS_URL as string);
  });

  afterAll(async () => {
    if (created.length > 0) {
      await sql`DELETE FROM users WHERE email = ANY(${created})`.execute(admin);
    }
    await admin.destroy();
    redis.disconnect();
    await app.close();
  });

  async function registerAndLogin(): Promise<{ cookie: string; csrf: string; email: string }> {
    const email = `revoke-${randomUUID()}@example.com`;
    created.push(email);
    await request(app.getHttpServer())
      .post("/api/v1/auth/signup")
      .send({ email, password: PASSWORD });
    const login = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password: PASSWORD });
    return { cookie: cookieOf(login), csrf: login.body.csrfToken, email };
  }

  it("logout-all denies every prior session for the user (AC1)", async () => {
    const email = `revoke-${randomUUID()}@example.com`;
    created.push(email);
    await request(app.getHttpServer())
      .post("/api/v1/auth/signup")
      .send({ email, password: PASSWORD });
    // Two independent sessions (two logins).
    const s1 = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password: PASSWORD });
    const s2 = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password: PASSWORD });
    const c1 = cookieOf(s1);
    const c2 = cookieOf(s2);

    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/logout-all")
      .set("Cookie", c1)
      .set("X-CSRF-Token", s1.body.csrfToken);
    expect(res.status).toBe(204);

    for (const c of [c1, c2]) {
      const me = await request(app.getHttpServer()).get("/api/v1/auth/me").set("Cookie", c);
      expect(me.status).toBe(401);
    }
  });

  it("bounds the user_sessions set with a TTL so abandoned sets can't leak (AC6)", async () => {
    const { cookie } = await registerAndLogin();
    const token = tokenOf(cookie);
    // Recover the userId from the stored record to address the per-user set.
    const raw = await redis.get(`session:${token}`);
    expect(raw).not.toBeNull();
    const { userId } = JSON.parse(raw as string) as SessionRecord;

    // The set exists and carries a positive TTL bounded by the 12-h absolute cap
    // (default 43200s) - not -1 (persistent), which is the leak this guards.
    const ttl = await redis.ttl(`user_sessions:${userId}`);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(43200);
  });

  it("logout-all without a CSRF token → 403 GRUMPY_OWL (AC5)", async () => {
    const { cookie } = await registerAndLogin();
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/logout-all")
      .set("Cookie", cookie);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("GRUMPY_OWL");
  });

  it("a session past its idle TTL is 401 on the next request (AC2/AC3)", async () => {
    const { cookie } = await registerAndLogin();
    // Simulate the idle-TTL key having lapsed: the Redis key expires.
    await redis.del(`session:${tokenOf(cookie)}`);
    const me = await request(app.getHttpServer()).get("/api/v1/auth/me").set("Cookie", cookie);
    expect(me.status).toBe(401);
    expect(me.body.error.code).toBe("SLEEPY_OWL");
  });

  it("a session past the 12-h absolute cap is 401 even with a fresh idle TTL (AC4)", async () => {
    const token = `abs-${randomUUID()}`;
    const userId = randomUUID();
    const stale: SessionRecord = {
      userId,
      csrfToken: "c",
      createdAt: Date.now() - 13 * 3600 * 1000, // older than the 12-h cap
      lastSeenAt: Date.now(),
    };
    // Fresh idle TTL, so only the absolute cap can reject it.
    await redis.set(`session:${token}`, JSON.stringify(stale), "EX", 1800);
    await redis.sadd(`user_sessions:${userId}`, token);

    const me = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Cookie", `${COOKIE_PREFIX}${token}`);
    expect(me.status).toBe(401);
    expect(me.body.error.code).toBe("SLEEPY_OWL");
    // read() destroyed the capped session.
    expect(await redis.exists(`session:${token}`)).toBe(0);
    await redis.del(`user_sessions:${userId}`);
  });
});
