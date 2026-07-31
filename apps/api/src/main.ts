import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { Kysely } from "kysely";
import { AppModule } from "./app.module";
import { assertBootSafety } from "./bootstrap/boot-safety";
import { configureApp } from "./bootstrap/configure-app";
import { AppConfigService } from "./config/app-config.service";
import { type Database, KYSELY } from "./db/database";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  app.enableShutdownHooks();

  // Refuse to start unless the DB role is non-privileged and RLS is active.
  const db = app.get<Kysely<Database>>(KYSELY);
  await assertBootSafety(db);

  const config = app.get(AppConfigService);
  await app.listen(config.port);
}

bootstrap().catch((error: unknown) => {
  // Config validation / boot-safety / bind failures land here; name the cause and exit non-zero.
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
