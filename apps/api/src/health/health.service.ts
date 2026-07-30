import { Inject, Injectable } from "@nestjs/common";
import type Redis from "ioredis";
import { type Kysely, sql } from "kysely";
import { type Database, KYSELY } from "../db/database";
import { REDIS } from "../redis/redis.module";

export interface HealthResult {
  status: "ok" | "degraded";
  checks: {
    postgres: boolean;
    redis: boolean;
  };
}

/**
 * Probes Postgres and Redis concurrently and independently — one failing
 * dependency never masks the other's true state (togglr-api.md:88,102-103).
 */
@Injectable()
export class HealthService {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<Database>,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async check(): Promise<HealthResult> {
    const [postgres, redis] = await Promise.all([this.checkPostgres(), this.checkRedis()]);
    return {
      status: postgres && redis ? "ok" : "degraded",
      checks: { postgres, redis },
    };
  }

  private async checkPostgres(): Promise<boolean> {
    try {
      await sql`SELECT 1`.execute(this.db);
      return true;
    } catch {
      return false;
    }
  }

  private async checkRedis(): Promise<boolean> {
    try {
      return (await this.redis.ping()) === "PONG";
    } catch {
      return false;
    }
  }
}
