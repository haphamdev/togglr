import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import Redis from "ioredis";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../app.module";
import type { Database } from "../db/database";
import { HealthService } from "./health.service";

function goodPg(): Kysely<Database> {
  return new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: new Pool({ connectionString: process.env.DATABASE_URL as string }),
    }),
  });
}

function badPg(): Kysely<Database> {
  return new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: new Pool({
        connectionString: "postgres://none:none@127.0.0.1:1/none",
        connectionTimeoutMillis: 500,
      }),
    }),
  });
}

function goodRedis(): Redis {
  return new Redis(process.env.REDIS_URL as string);
}

function badRedis(): Redis {
  return new Redis({
    host: "127.0.0.1",
    port: 1,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy: () => null,
  });
}

describe("GET /healthz (integration)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns 200 {status:ok, both true} when PG + Redis are up", async () => {
    const res = await request(app.getHttpServer()).get("/healthz");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", checks: { postgres: true, redis: true } });
  });

  it("is unauthenticated — no cookie/CSRF returns 200/503, never 401/403", async () => {
    const res = await request(app.getHttpServer()).get("/healthz");
    expect([200, 503]).toContain(res.status);
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });
});

describe("HealthService degraded combinations (integration)", () => {
  it("reports postgres:false, redis:true when Postgres is unreachable", async () => {
    const db = badPg();
    const redis = goodRedis();
    const result = await new HealthService(db, redis).check();
    expect(result).toEqual({ status: "degraded", checks: { postgres: false, redis: true } });
    await db.destroy();
    redis.disconnect();
  });

  it("reports redis:false, postgres:true when Redis is unreachable", async () => {
    const db = goodPg();
    const redis = badRedis();
    const result = await new HealthService(db, redis).check();
    expect(result).toEqual({ status: "degraded", checks: { postgres: true, redis: false } });
    await db.destroy();
    redis.disconnect();
  });

  it("reports both false when both are unreachable", async () => {
    const db = badPg();
    const redis = badRedis();
    const result = await new HealthService(db, redis).check();
    expect(result).toEqual({ status: "degraded", checks: { postgres: false, redis: false } });
    await db.destroy();
    redis.disconnect();
  });
});
