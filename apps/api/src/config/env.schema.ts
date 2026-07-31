import { z } from "zod";

/**
 * Authoritative environment surface for the API. Every consumer reads config
 * through the typed accessor — never process.env directly. Validation runs at
 * ConfigModule init so a missing/invalid var aborts boot before listen.
 */
export const envSchema = z.object({
  // togglr_app request-role DSN (RLS applies). Consumed by the Kysely pool.
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3000),
  // Kysely/pg connection-pool tuning — all optional with sensible defaults.
  DB_POOL_MAX: z.coerce.number().int().positive().default(10),
  DB_POOL_CONNECTION_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  DB_POOL_IDLE_TIMEOUT_MS: z.coerce.number().int().nonnegative().default(10000),
  // Session lifecycle (Redis-backed): 30-min idle TTL, 12-h absolute cap.
  SESSION_IDLE_TTL_S: z.coerce.number().int().positive().default(1800),
  SESSION_ABSOLUTE_TTL_S: z.coerce.number().int().positive().default(43200),
  // Session-cookie Secure flag. Default true (prod); set false for the local
  // http://localhost dev SPA served via the Vite proxy.
  COOKIE_SECURE: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  // SDK-key rotation grace window: how long a rotated key stays valid alongside
  // its replacement (24 h default; org-sdk-keys, cp:154).
  SDK_KEY_ROTATION_GRACE_S: z.coerce.number().int().positive().default(86400),
  // Outbound mail (invite links). Mailhog is the dev SMTP sink (docker-compose).
  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  MAIL_FROM: z.string().default("togglr <no-reply@togglr.local>"),
  // Base URL of the web app, used to build invite links (`/invite/:token`).
  WEB_BASE_URL: z.string().default("http://localhost:5173"),
});
// Migration-only secrets are deliberately excluded from the API's boot surface:
// the API runs least-privilege as togglr_app and never holds the superuser DSN.
// DATABASE_MIGRATION_URL is validated by node-pg-migrate; TOGGLR_APP_PASSWORD by
// the baseline migration (migrations/1730000000000_baseline.js).

export type AppConfig = z.infer<typeof envSchema>;

/**
 * ConfigModule `validate` hook. Throws an Error naming the offending key(s) so
 * boot fails fast with a diagnosable message instead of a generic failure.
 */
export function validate(raw: Record<string, unknown>): AppConfig {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const keys = result.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Invalid/missing env: ${keys}`);
  }
  return result.data;
}
