import { randomBytes } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type Redis from "ioredis";
import { DomainException } from "../common/domain-exception";
import { AppConfigService } from "../config/app-config.service";
import { REDIS } from "../redis/redis.module";

/** Persisted per-session record (timestamps are epoch ms). */
export interface SessionRecord {
  userId: string;
  csrfToken: string;
  createdAt: number;
  lastSeenAt: number;
}

const sessionKey = (token: string) => `session:${token}`;
const userSessionsKey = (userId: string) => `user_sessions:${userId}`;
const newToken = () => randomBytes(32).toString("base64url");

/**
 * Redis-backed server-side session store. Sessions are opaque random tokens
 * (never JWTs) mapping to a {@link SessionRecord}. Two lifetimes apply: a
 * sliding idle TTL (refreshed on every read) and a hard absolute cap enforced
 * against `createdAt`. A per-user set (`user_sessions:<userId>`) tracks a user's
 * live tokens for instant "log out everywhere" revocation.
 *
 * Every Redis call is wrapped so a store outage surfaces as `503 DIZZY_OWL`
 * rather than a leaked driver error.
 */
@Injectable()
export class SessionService {
  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(AppConfigService) private readonly config: AppConfigService,
  ) {}

  /** Mint a new session for `userId`; returns the session + CSRF tokens. */
  async create(userId: string): Promise<{ token: string; csrfToken: string }> {
    const token = newToken();
    const csrfToken = newToken();
    const now = Date.now();
    const record: SessionRecord = { userId, csrfToken, createdAt: now, lastSeenAt: now };
    await this.guarded(async () => {
      // Drop set members whose session keys have already lapsed (idle timeout)
      // so a user's set stays bounded across repeated logins (AC6).
      await this.pruneMembers(userId);
      await this.redis.set(
        sessionKey(token),
        JSON.stringify(record),
        "EX",
        this.config.sessionIdleTtlS,
      );
      await this.redis.sadd(userSessionsKey(userId), token);
      // Bound the set's lifetime to the absolute cap so an abandoned user (who
      // never logs out or back in to trigger pruning) can't leave dead members
      // in Redis forever. Each new session resets it; a live user's set never
      // lapses out from under an active token (which lives at most the cap).
      await this.redis.expire(userSessionsKey(userId), this.config.sessionAbsoluteTtlS);
    });
    return { token, csrfToken };
  }

  /**
   * Resolve a token to its record, or null when absent/expired/revoked. Enforces
   * the absolute cap (destroys + returns null past it) and, on a valid hit,
   * refreshes both the idle TTL and `lastSeenAt` (sliding session).
   */
  async read(token: string): Promise<SessionRecord | null> {
    return this.guarded(async () => {
      const raw = await this.redis.get(sessionKey(token));
      if (raw === null) return null;
      const record = JSON.parse(raw) as SessionRecord;

      const now = Date.now();
      if (now - record.createdAt > this.config.sessionAbsoluteTtlS * 1000) {
        await this.destroy(token);
        return null;
      }

      record.lastSeenAt = now;
      await this.redis.set(
        sessionKey(token),
        JSON.stringify(record),
        "EX",
        this.config.sessionIdleTtlS,
      );
      return record;
    });
  }

  /** Delete a single session (idempotent) and drop it from the user's set. */
  async destroy(token: string): Promise<void> {
    await this.guarded(async () => {
      const raw = await this.redis.get(sessionKey(token));
      const userId = raw ? (JSON.parse(raw) as SessionRecord).userId : null;
      await this.redis.del(sessionKey(token));
      if (userId) await this.redis.srem(userSessionsKey(userId), token);
    });
  }

  /** Revoke every session for a user (instant "log out everywhere"). */
  async destroyAll(userId: string): Promise<void> {
    await this.guarded(async () => {
      const tokens = await this.redis.smembers(userSessionsKey(userId));
      if (tokens.length > 0) {
        await this.redis.del(...tokens.map(sessionKey));
      }
      await this.redis.del(userSessionsKey(userId));
    });
  }

  /**
   * Drop set members whose `session:<token>` key no longer exists (expired/
   * revoked) so the per-user set does not accumulate dead tokens. Returns the
   * still-live tokens.
   */
  async prune(userId: string): Promise<string[]> {
    return this.guarded(() => this.pruneMembers(userId));
  }

  /** Unguarded prune body; call only from within {@link guarded}. */
  private async pruneMembers(userId: string): Promise<string[]> {
    const tokens = await this.redis.smembers(userSessionsKey(userId));
    const dead: string[] = [];
    for (const token of tokens) {
      if ((await this.redis.exists(sessionKey(token))) === 0) dead.push(token);
    }
    if (dead.length > 0) await this.redis.srem(userSessionsKey(userId), ...dead);
    return tokens.filter((t) => !dead.includes(t));
  }

  /** Map any thrown Redis error to 503 DIZZY_OWL; never leak the driver error. */
  private async guarded<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof DomainException) throw err;
      throw new DomainException("DIZZY_OWL", 503, "session store unavailable");
    }
  }
}
