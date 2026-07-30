import { Global, Inject, Logger, Module, type OnApplicationShutdown } from "@nestjs/common";
import Redis from "ioredis";
import { AppConfigService } from "../config/app-config.service";

/** DI token for the injectable ioredis client. */
export const REDIS = Symbol("REDIS");

const redisLogger = new Logger("Redis");

/**
 * Provides the shared ioredis client (from REDIS_URL). Global so the health
 * check and later Pub/Sub consumers can inject the REDIS token.
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService): Redis => {
        const client = new Redis(config.redisUrl);
        // Prevent an unhandled 'error' (Redis down) from crashing the process;
        // the health probe surfaces the outage instead.
        client.on("error", (err) => redisLogger.warn(`connection error: ${err.message}`));
        return client;
      },
    },
  ],
  exports: [REDIS],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async onApplicationShutdown(): Promise<void> {
    // Graceful drain when the connection is live: quit() completes pending replies
    // then closes. Guard on status so quit() can't hang on a reconnect loop when
    // Redis is already down, and force-close on any failure.
    if (this.redis.status === "ready") {
      try {
        await this.redis.quit();
        return;
      } catch (err) {
        redisLogger.warn(`graceful quit failed, forcing disconnect: ${(err as Error).message}`);
      }
    }
    this.redis.disconnect();
  }
}
