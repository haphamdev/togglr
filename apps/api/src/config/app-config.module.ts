import { join } from "node:path";
import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppConfigService } from "./app-config.service";
import { validate } from "./env.schema";

/**
 * Global config module. `validate` runs during init — a missing/invalid env var
 * throws here and aborts NestFactory.create before the app can listen.
 */
@Global()
@Module({
  imports: [
    // Repo-root .env resolved relative to this module (not process.cwd()), so it
    // loads the same file under `tsx` (src/config) and `node dist/config` no
    // matter the working directory. Absent in prod/CI is fine — real process.env
    // still wins and ConfigModule ignores a missing env file.
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
      envFilePath: [join(__dirname, "../../../../.env")],
    }),
  ],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
