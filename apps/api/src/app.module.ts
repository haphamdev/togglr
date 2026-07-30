import { Module } from "@nestjs/common";
import { AppConfigModule } from "./config/app-config.module";
import { DbModule } from "./db/db.module";
import { HealthModule } from "./health/health.module";
import { RedisModule } from "./redis/redis.module";

@Module({
  imports: [AppConfigModule, DbModule, RedisModule, HealthModule],
})
export class AppModule {}
