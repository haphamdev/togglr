import { Global, Inject, Logger, Module, type OnApplicationShutdown } from "@nestjs/common";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { AppConfigService } from "../config/app-config.service";
import { type Database, KYSELY } from "./database";

const poolLogger = new Logger("DbPool");

/**
 * Provides the request-path Kysely instance (connects as the togglr_app role via
 * DATABASE_URL — non-superuser, RLS-enforced). Global so repositories and the
 * health check can inject the KYSELY token anywhere.
 */
@Global()
@Module({
  providers: [
    {
      provide: KYSELY,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService): Kysely<Database> => {
        // Bounded pool + connect timeout so a stalled DB fails fast on acquisition
        // instead of hanging requests; sizes/timeouts tunable via DB_POOL_* env.
        const pool = new Pool({ connectionString: config.databaseUrl, ...config.dbPoolOptions });
        // Idle clients emit 'error' when Postgres restarts/drops; handle it so a
        // dependency blip degrades /healthz instead of crashing the process.
        pool.on("error", (err) => poolLogger.warn(`idle client error: ${err.message}`));
        return new Kysely<Database>({ dialect: new PostgresDialect({ pool }) });
      },
    },
  ],
  exports: [KYSELY],
})
export class DbModule implements OnApplicationShutdown {
  constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

  async onApplicationShutdown(): Promise<void> {
    await this.db.destroy();
  }
}
