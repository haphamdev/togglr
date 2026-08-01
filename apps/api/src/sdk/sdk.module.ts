import { Module } from "@nestjs/common";
import { OrgModule } from "../org/org.module";
import { RulesetController } from "./ruleset.controller";
import { RulesetService } from "./ruleset.service";

/**
 * SDK delivery plane. Imports OrgModule for `SdkKeyGuard` (bearer-key auth) and
 * `TenantContextService`/`TransactionInterceptor` (the RLS tenant transaction the
 * ruleset assembly reads under).
 */
@Module({
  imports: [OrgModule],
  controllers: [RulesetController],
  providers: [RulesetService],
})
export class SdkModule {}
