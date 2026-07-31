import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import type { Member } from "@togglr/shared-types";
import { z } from "zod";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { MembersService } from "./members.service";
import { OrgContextGuard } from "./org-context.guard";
import { Roles } from "./roles.decorator";
import { RolesGuard } from "./roles.guard";
import { TransactionInterceptor } from "./tenant/transaction.interceptor";

const RoleSchema = z.object({ role: z.enum(["owner", "admin", "member"]) });
type RoleBody = z.infer<typeof RoleSchema>;

/**
 * Member management for an org (`/orgs/:orgSlug/members`). Class-level org guards
 * + tenant interceptor: list is any-member; role change / removal are owner-only.
 */
@Controller("orgs/:orgSlug/members")
@UseGuards(OrgContextGuard, RolesGuard)
@UseInterceptors(TransactionInterceptor)
export class MembersController {
  constructor(@Inject(MembersService) private readonly members: MembersService) {}

  @Get()
  async list(): Promise<{ members: Member[] }> {
    return { members: await this.members.list() };
  }

  @Patch(":userId")
  @Roles("owner")
  async updateRole(
    @Param("userId") userId: string,
    @Body(new ZodValidationPipe(RoleSchema)) body: RoleBody,
  ): Promise<{ member: Member }> {
    return { member: await this.members.updateRole(userId, body.role) };
  }

  @Delete(":userId")
  @Roles("owner")
  @HttpCode(204)
  async remove(@Param("userId") userId: string): Promise<void> {
    await this.members.remove(userId);
  }
}
