import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Req,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import type { FlagEnvConfigDetail, FlagEnvConfigUpdated } from "@togglr/shared-types";
import { z } from "zod";
import type { AuthedRequest } from "../auth/authed-request";
import { DomainException } from "../common/domain-exception";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { OrgContextGuard } from "../org/org-context.guard";
import { Roles } from "../org/roles.decorator";
import { RolesGuard } from "../org/roles.guard";
import { TransactionInterceptor } from "../org/tenant/transaction.interceptor";
import { FlagConfigService } from "./flag-config.service";

// Shallow on `rules` so deep rule errors surface as CURIOUS_CAT from the service, not
// CLUMSY_OWL from the pipe. `expectedConfigVersion` required → its absence is CLUMSY_OWL (AC4).
const PatchConfigSchema = z
  .object({
    expectedConfigVersion: z.number().int(),
    enabled: z.boolean().optional(),
    defaultVariation: z.boolean().optional(),
    rules: z.array(z.unknown()).optional(),
  })
  .refine(
    (v) => v.enabled !== undefined || v.defaultVariation !== undefined || v.rules !== undefined,
    {
      message: "at least one of enabled, defaultVariation, rules is required",
    },
  );
type PatchConfigBody = z.infer<typeof PatchConfigSchema>;

function requireUserId(req: AuthedRequest): string {
  const userId = req.session?.userId;
  if (!userId) throw new DomainException("SLEEPY_OWL", 401, "Missing or invalid session");
  return userId;
}

@Controller("orgs/:orgSlug/projects/:projectKey/flags/:flagKey/environments/:envKey/config")
@UseGuards(OrgContextGuard, RolesGuard)
@UseInterceptors(TransactionInterceptor)
export class FlagConfigController {
  constructor(@Inject(FlagConfigService) private readonly config: FlagConfigService) {}

  @Get()
  async get(
    @Param("projectKey") projectKey: string,
    @Param("flagKey") flagKey: string,
    @Param("envKey") envKey: string,
  ): Promise<{ config: FlagEnvConfigDetail }> {
    return { config: await this.config.get(projectKey, flagKey, envKey) };
  }

  @Patch()
  @Roles("admin")
  async patch(
    @Req() req: AuthedRequest,
    @Param("projectKey") projectKey: string,
    @Param("flagKey") flagKey: string,
    @Param("envKey") envKey: string,
    @Body(new ZodValidationPipe(PatchConfigSchema)) body: PatchConfigBody,
  ): Promise<{ config: FlagEnvConfigUpdated }> {
    return {
      config: await this.config.patch(projectKey, flagKey, envKey, requireUserId(req), body),
    };
  }
}
