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
