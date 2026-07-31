import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Patch,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import type { OrgSummary } from "@togglr/shared-types";
import { z } from "zod";
import type { AuthedRequest } from "../auth/authed-request";
import { DomainException } from "../common/domain-exception";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { OrgService } from "./org.service";
import { OrgContextGuard } from "./org-context.guard";
import { Roles } from "./roles.decorator";
import { RolesGuard } from "./roles.guard";
import { TransactionInterceptor } from "./tenant/transaction.interceptor";

const CreateOrgSchema = z.object({
  name: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/),
});
type CreateOrgBody = z.infer<typeof CreateOrgSchema>;

const RenameOrgSchema = z.object({ name: z.string().min(1) });
type RenameOrgBody = z.infer<typeof RenameOrgSchema>;

/** SessionGuard guarantees a session on protected routes; guard defensively. */
function requireUserId(req: AuthedRequest): string {
  const userId = req.session?.userId;
  if (!userId) throw new DomainException("SLEEPY_OWL", 401, "Missing or invalid session");
  return userId;
}

/**
 * Org collection routes (`/orgs`). No `:orgSlug`, so they bypass the org guards
 * and manage their own bootstrap access: create opens its own RLS transaction,
 * list reads cross-tenant memberships. Session + CSRF are enforced globally.
 */
@Controller("orgs")
export class OrgsController {
  constructor(@Inject(OrgService) private readonly orgs: OrgService) {}

  @Post()
  @HttpCode(201)
  async create(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(CreateOrgSchema)) body: CreateOrgBody,
  ): Promise<{ org: OrgSummary }> {
    return { org: await this.orgs.create(requireUserId(req), body) };
  }

  @Get()
  async list(@Req() req: AuthedRequest): Promise<{ orgs: OrgSummary[] }> {
    return { orgs: await this.orgs.listForUser(requireUserId(req)) };
  }
}

/**
 * Org detail/rename (`/orgs/:orgSlug`). Class-level org guards + interceptor:
 * OrgContextGuard resolves the org/role, RolesGuard enforces `@Roles`, the
 * interceptor opens the tenant transaction.
 */
@Controller("orgs/:orgSlug")
@UseGuards(OrgContextGuard, RolesGuard)
@UseInterceptors(TransactionInterceptor)
export class OrgController {
  constructor(@Inject(OrgService) private readonly orgs: OrgService) {}

  @Get()
  async detail(): Promise<{ org: OrgSummary }> {
    return { org: await this.orgs.getCurrent() };
  }

  @Patch()
  @Roles("owner")
  async rename(
    @Body(new ZodValidationPipe(RenameOrgSchema)) body: RenameOrgBody,
  ): Promise<{ org: OrgSummary }> {
    return { org: await this.orgs.rename(body.name) };
  }
}
