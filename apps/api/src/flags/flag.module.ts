import { Module } from "@nestjs/common";
import { OrgModule } from "../org/org.module";
import { FlagConfigController } from "./flag-config.controller";
import { FlagConfigService } from "./flag-config.service";
import { FlagsController } from "./flags.controller";
import { FlagsService } from "./flags.service";

@Module({
  imports: [OrgModule],
  controllers: [FlagsController, FlagConfigController],
  providers: [FlagsService, FlagConfigService],
})
export class FlagModule {}
