import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { AuthModule } from "./auth/auth.module";
import { AllExceptionsFilter } from "./common/all-exceptions.filter";
import { AppConfigModule } from "./config/app-config.module";
import { DbModule } from "./db/db.module";
import { FlagModule } from "./flags/flag.module";
import { HealthModule } from "./health/health.module";
import { OrgModule } from "./org/org.module";
import { RedisModule } from "./redis/redis.module";
import { SdkModule } from "./sdk/sdk.module";

@Module({
  imports: [
    AppConfigModule,
    DbModule,
    RedisModule,
    HealthModule,
    AuthModule,
    OrgModule,
    FlagModule,
    SdkModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
export class AppModule {}
