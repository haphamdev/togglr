import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AppConfig } from "./env.schema";

/**
 * Typed, non-optional accessor over the validated env. Downstream code injects
 * this instead of reading process.env or the untyped ConfigService.
 */
@Injectable()
export class AppConfigService {
  constructor(@Inject(ConfigService) private readonly config: ConfigService<AppConfig, true>) {}

  get databaseUrl(): string {
    return this.config.get("DATABASE_URL", { infer: true });
  }

  get redisUrl(): string {
    return this.config.get("REDIS_URL", { infer: true });
  }

  get port(): number {
    return this.config.get("PORT", { infer: true });
  }

  get sessionIdleTtlS(): number {
    return this.config.get("SESSION_IDLE_TTL_S", { infer: true });
  }

  get sessionAbsoluteTtlS(): number {
    return this.config.get("SESSION_ABSOLUTE_TTL_S", { infer: true });
  }

  get cookieSecure(): boolean {
    return this.config.get("COOKIE_SECURE", { infer: true });
  }

  get sdkKeyRotationGraceS(): number {
    return this.config.get("SDK_KEY_ROTATION_GRACE_S", { infer: true });
  }

  get smtpHost(): string {
    return this.config.get("SMTP_HOST", { infer: true });
  }

  get smtpPort(): number {
    return this.config.get("SMTP_PORT", { infer: true });
  }

  get mailFrom(): string {
    return this.config.get("MAIL_FROM", { infer: true });
  }

  get webBaseUrl(): string {
    return this.config.get("WEB_BASE_URL", { infer: true });
  }

  /** pg Pool tuning, keyed by pg's own option names for a direct spread. */
  get dbPoolOptions(): { max: number; connectionTimeoutMillis: number; idleTimeoutMillis: number } {
    return {
      max: this.config.get("DB_POOL_MAX", { infer: true }),
      connectionTimeoutMillis: this.config.get("DB_POOL_CONNECTION_TIMEOUT_MS", { infer: true }),
      idleTimeoutMillis: this.config.get("DB_POOL_IDLE_TIMEOUT_MS", { infer: true }),
    };
  }
}
