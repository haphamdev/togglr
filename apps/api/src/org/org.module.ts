import { Module } from "@nestjs/common";
import { EnvironmentsController } from "./environments.controller";
import { EnvironmentsService } from "./environments.service";
import { InvitesController } from "./invites.controller";
import { InvitesService } from "./invites.service";
import { MailService } from "./mail/mail.service";
import { MembersController } from "./members.controller";
import { MembersService } from "./members.service";
import { MembershipQueryService } from "./membership-query.service";
import { OrgController, OrgsController } from "./org.controller";
import { OrgService } from "./org.service";
import { OrgContextGuard } from "./org-context.guard";
import { ProjectsController } from "./projects.controller";
import { ProjectsService } from "./projects.service";
import { RolesGuard } from "./roles.guard";
import { SdkKeyGuard } from "./sdk-keys/sdk-key.guard";
import { SdkKeyService } from "./sdk-keys/sdk-key.service";
import { SdkKeysController } from "./sdk-keys/sdk-keys.controller";
import { TenantContextService } from "./tenant/tenant-context.service";
import { TransactionInterceptor } from "./tenant/transaction.interceptor";

/**
 * Org Workspace & Isolation. Owns the per-request tenant transaction machinery
 * (TenantContextService + TransactionInterceptor), the org-scoping guards
 * (OrgContextGuard + RolesGuard), and the control-plane controllers/services.
 * Exports MembershipQueryService so AuthModule can populate the `/auth/me` +
 * login memberships seam. Depends on nothing in AuthModule (one-directional):
 * OrgContextGuard reads `req.session.userId` set by the global SessionGuard.
 */
@Module({
  controllers: [
    OrgsController,
    OrgController,
    MembersController,
    ProjectsController,
    EnvironmentsController,
    InvitesController,
    SdkKeysController,
  ],
  providers: [
    TenantContextService,
    TransactionInterceptor,
    OrgContextGuard,
    RolesGuard,
    OrgService,
    MembersService,
    ProjectsService,
    EnvironmentsService,
    InvitesService,
    MailService,
    SdkKeyService,
    SdkKeyGuard,
    MembershipQueryService,
  ],
  exports: [
    TenantContextService,
    TransactionInterceptor,
    OrgContextGuard,
    RolesGuard,
    MembershipQueryService,
    InvitesService,
    SdkKeyGuard,
    SdkKeyService,
  ],
})
export class OrgModule {}
