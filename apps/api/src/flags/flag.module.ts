import { Module } from "@nestjs/common";
import { OrgModule } from "../org/org.module";
import { FlagConfigController } from "./flag-config.controller";
import { FlagConfigService } from "./flag-config.service";
import { FlagPreviewController } from "./flag-preview.controller";
import { FlagPreviewService } from "./flag-preview.service";
import { FlagsController } from "./flags.controller";
import { FlagsService } from "./flags.service";

@Module({
  imports: [OrgModule],
  controllers: [FlagsController, FlagConfigController, FlagPreviewController],
  providers: [FlagsService, FlagConfigService, FlagPreviewService],
})
export class FlagModule {}
