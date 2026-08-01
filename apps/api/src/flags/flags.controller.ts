import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import type { FlagWithEnvironments } from "@togglr/shared-types";
import { z } from "zod";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { OrgContextGuard } from "../org/org-context.guard";
import { Roles } from "../org/roles.decorator";
import { RolesGuard } from "../org/roles.guard";
import { TransactionInterceptor } from "../org/tenant/transaction.interceptor";
import { FlagsService } from "./flags.service";

const CreateFlagSchema = z.object({
  key: z.string().min(1),
  description: z.string().optional(),
  type: z.literal("boolean").optional(),
});
type CreateFlagBody = z.infer<typeof CreateFlagSchema>;

const PatchFlagSchema = z
  .object({ description: z.string().nullable().optional(), archived: z.boolean().optional() })
  .refine((v) => v.description !== undefined || v.archived !== undefined, {
    message: "description or archived is required",
  });
type PatchFlagBody = z.infer<typeof PatchFlagSchema>;

@Controller("orgs/:orgSlug/projects/:projectKey/flags")
@UseGuards(OrgContextGuard, RolesGuard)
@UseInterceptors(TransactionInterceptor)
export class FlagsController {
  constructor(@Inject(FlagsService) private readonly flags: FlagsService) {}

  @Post()
  @Roles("admin")
  @HttpCode(201)
  async create(
    @Param("projectKey") projectKey: string,
    @Body(new ZodValidationPipe(CreateFlagSchema)) body: CreateFlagBody,
  ): Promise<{ flag: FlagWithEnvironments }> {
    return { flag: await this.flags.create(projectKey, body) };
  }

  @Get()
  async list(
    @Param("projectKey") projectKey: string,
    @Query("includeArchived") includeArchived?: string,
  ): Promise<{ flags: FlagWithEnvironments[] }> {
    return { flags: await this.flags.list(projectKey, includeArchived === "true") };
  }

  @Get(":flagKey")
  async detail(
    @Param("projectKey") projectKey: string,
    @Param("flagKey") flagKey: string,
  ): Promise<{ flag: FlagWithEnvironments }> {
    return { flag: await this.flags.get(projectKey, flagKey) };
  }

  @Patch(":flagKey")
  @Roles("admin")
  async update(
    @Param("projectKey") projectKey: string,
    @Param("flagKey") flagKey: string,
    @Body(new ZodValidationPipe(PatchFlagSchema)) body: PatchFlagBody,
  ): Promise<{ flag: FlagWithEnvironments }> {
    return { flag: await this.flags.patch(projectKey, flagKey, body) };
  }
}
