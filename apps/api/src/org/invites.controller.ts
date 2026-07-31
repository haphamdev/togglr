import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import type { Invite } from "@togglr/shared-types";
import { z } from "zod";
import type { AuthedRequest } from "../auth/authed-request";
import { DomainException } from "../common/domain-exception";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { InvitesService } from "./invites.service";
import { OrgContextGuard } from "./org-context.guard";
import { Roles } from "./roles.decorator";
import { RolesGuard } from "./roles.guard";
import { TransactionInterceptor } from "./tenant/transaction.interceptor";

const CreateInviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["owner", "admin", "member"]),
});
type CreateInviteBody = z.infer<typeof CreateInviteSchema>;

function requireUserId(req: AuthedRequest): string {
  const userId = req.session?.userId;
  if (!userId) throw new DomainException("SLEEPY_OWL", 401, "Missing or invalid session");
  return userId;
}

/** Invite management for an org (`/orgs/:orgSlug/invites`). Admin-gated. */
@Controller("orgs/:orgSlug/invites")
@UseGuards(OrgContextGuard, RolesGuard)
@UseInterceptors(TransactionInterceptor)
export class InvitesController {
  constructor(@Inject(InvitesService) private readonly invites: InvitesService) {}

  @Post()
  @Roles("admin")
  @HttpCode(201)
  async create(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(CreateInviteSchema)) body: CreateInviteBody,
  ): Promise<{ invite: Invite }> {
    return { invite: await this.invites.create(body, requireUserId(req)) };
  }

  @Get()
  @Roles("admin")
  async list(): Promise<{ invites: Invite[] }> {
    return { invites: await this.invites.list() };
  }

  @Post(":inviteId/resend")
  @Roles("admin")
  @HttpCode(200)
  async resend(@Param("inviteId") inviteId: string): Promise<{ invite: Invite }> {
    return { invite: await this.invites.resend(inviteId) };
  }

  @Delete(":inviteId")
  @Roles("admin")
  @HttpCode(204)
  async revoke(@Param("inviteId") inviteId: string): Promise<void> {
    await this.invites.revoke(inviteId);
  }
}
