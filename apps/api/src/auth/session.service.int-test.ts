import { randomUUID } from "node:crypto";
import Redis from "ioredis";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DomainException } from "../common/domain-exception";
import type { AppConfigService } from "../config/app-config.service";
import { type SessionRecord, SessionService } from "./session.service";

function configStub(idleTtlS: number, absoluteTtlS: number): AppConfigService {
  return { sessionIdleTtlS: idleTtlS, sessionAbsoluteTtlS: absoluteTtlS } as AppConfigService;
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("SessionService (integration, real Redis)", () => {
  let redis: Redis;

  beforeAll(() => {
    redis = goodRedis();
  });

  afterAll(async () => {
    redis.disconnect();
  });

  it("create → read returns the record, refreshes lastSeenAt and the idle TTL", async () => {
    const svc = new SessionService(redis, configStub(1800, 43200));
    const userId = randomUUID();
    const { token, csrfToken } = await svc.create(userId);

    // set membership + key present with an idle-scoped TTL
    expect(await redis.sismember(`user_sessions:${userId}`, token)).toBe(1);
    const ttl0 = await redis.ttl(`session:${token}`);
    expect(ttl0).toBeGreaterThan(1700);
    expect(ttl0).toBeLessThanOrEqual(1800);

    await sleep(20);
    const record = await svc.read(token);
    expect(record).not.toBeNull();
    expect(record?.userId).toBe(userId);
    expect(record?.csrfToken).toBe(csrfToken);
    expect(record?.lastSeenAt).toBeGreaterThan(record?.createdAt as number);
    // TTL refreshed back toward the idle ceiling.
    expect(await redis.ttl(`session:${token}`)).toBeGreaterThan(1700);

    await svc.destroy(token);
  });

  it("read past the idle TTL returns null (session expired)", async () => {
    const svc = new SessionService(redis, configStub(1, 43200));
    const { token } = await svc.create(randomUUID());
    await sleep(1200);
    expect(await svc.read(token)).toBeNull();
  });

  it("read past the absolute cap returns null and destroys the session", async () => {
    const svc = new SessionService(redis, configStub(1800, 3600));
    const userId = randomUUID();
    const token = "abs-cap-token";
    const stale: SessionRecord = {
      userId,
      csrfToken: "c",
      createdAt: Date.now() - 3601 * 1000,
      lastSeenAt: Date.now(),
    };
    await redis.set(`session:${token}`, JSON.stringify(stale), "EX", 1800);
    await redis.sadd(`user_sessions:${userId}`, token);

    expect(await svc.read(token)).toBeNull();
    expect(await redis.exists(`session:${token}`)).toBe(0);
    await redis.del(`user_sessions:${userId}`);
  });

  it("destroy removes the key and the set member", async () => {
    const svc = new SessionService(redis, configStub(1800, 43200));
    const userId = randomUUID();
    const { token } = await svc.create(userId);
    await svc.destroy(token);
    expect(await redis.exists(`session:${token}`)).toBe(0);
    expect(await redis.sismember(`user_sessions:${userId}`, token)).toBe(0);
    expect(await svc.read(token)).toBeNull();
  });

  it("destroyAll revokes every session for the user", async () => {
    const svc = new SessionService(redis, configStub(1800, 43200));
    const userId = randomUUID();
    const a = await svc.create(userId);
    const b = await svc.create(userId);
    await svc.destroyAll(userId);
    expect(await svc.read(a.token)).toBeNull();
    expect(await svc.read(b.token)).toBeNull();
    expect(await redis.exists(`user_sessions:${userId}`)).toBe(0);
  });

  it("prune drops set members whose session key no longer exists", async () => {
    const svc = new SessionService(redis, configStub(1800, 43200));
    const userId = randomUUID();
    const live = await svc.create(userId);
    const dead = await svc.create(userId);
    // Simulate the dead session's key expiring while the set member lingers.
    await redis.del(`session:${dead.token}`);

    const remaining = await svc.prune(userId);
    expect(remaining).toEqual([live.token]);
    expect(await redis.sismember(`user_sessions:${userId}`, dead.token)).toBe(0);
    expect(await redis.sismember(`user_sessions:${userId}`, live.token)).toBe(1);

    await svc.destroyAll(userId);
  });

  it("maps a Redis outage to 503 DIZZY_OWL", async () => {
    const down = badRedis();
    const svc = new SessionService(down, configStub(1800, 43200));
    try {
      await svc.create(randomUUID());
      expect.unreachable("expected DIZZY_OWL");
    } catch (err) {
      expect(err).toBeInstanceOf(DomainException);
      expect((err as DomainException).code).toBe("DIZZY_OWL");
      expect((err as DomainException).status).toBe(503);
    } finally {
      down.disconnect();
    }
  });
});
