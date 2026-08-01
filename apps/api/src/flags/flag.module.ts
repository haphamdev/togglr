import { Module } from "@nestjs/common";
import { OrgModule } from "../org/org.module";
import { FlagsController } from "./flags.controller";
import { FlagsService } from "./flags.service";

@Module({
  imports: [OrgModule],
  controllers: [FlagsController],
  providers: [FlagsService],
})
export class FlagModule {}
