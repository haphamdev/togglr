import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { AuthModule } from "./auth/auth.module";
import { AllExceptionsFilter } from "./common/all-exceptions.filter";
import { AppConfigModule } from "./config/app-config.module";
import { DbModule } from "./db/db.module";
import { HealthModule } from "./health/health.module";
import { OrgModule } from "./org/org.module";
import { RedisModule } from "./redis/redis.module";

@Module({
  imports: [AppConfigModule, DbModule, RedisModule, HealthModule, AuthModule, OrgModule],
  providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
export class AppModule {}
