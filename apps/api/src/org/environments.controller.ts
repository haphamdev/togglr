import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import type { Environment } from "@togglr/shared-types";
import { z } from "zod";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { EnvironmentsService } from "./environments.service";
import { OrgContextGuard } from "./org-context.guard";
import { Roles } from "./roles.decorator";
import { RolesGuard } from "./roles.guard";
import { TransactionInterceptor } from "./tenant/transaction.interceptor";

const CreateEnvSchema = z.object({
  key: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
});
type CreateEnvBody = z.infer<typeof CreateEnvSchema>;

const RenameSchema = z.object({ name: z.string().min(1) });
type RenameBody = z.infer<typeof RenameSchema>;

@Controller("orgs/:orgSlug/projects/:projectKey/environments")
@UseGuards(OrgContextGuard, RolesGuard)
@UseInterceptors(TransactionInterceptor)
export class EnvironmentsController {
  constructor(@Inject(EnvironmentsService) private readonly environments: EnvironmentsService) {}

  @Post()
  @Roles("admin")
  @HttpCode(201)
  async create(
    @Param("projectKey") projectKey: string,
    @Body(new ZodValidationPipe(CreateEnvSchema)) body: CreateEnvBody,
  ): Promise<{ environment: Environment }> {
    return { environment: await this.environments.create(projectKey, body) };
  }

  @Get()
  async list(@Param("projectKey") projectKey: string): Promise<{ environments: Environment[] }> {
    return { environments: await this.environments.list(projectKey) };
  }

  @Get(":envKey")
  async detail(
    @Param("projectKey") projectKey: string,
    @Param("envKey") envKey: string,
  ): Promise<{ environment: Environment }> {
    return { environment: await this.environments.get(projectKey, envKey) };
  }

  @Patch(":envKey")
  @Roles("admin")
  async rename(
    @Param("projectKey") projectKey: string,
    @Param("envKey") envKey: string,
    @Body(new ZodValidationPipe(RenameSchema)) body: RenameBody,
  ): Promise<{ environment: Environment }> {
    return { environment: await this.environments.rename(projectKey, envKey, body.name) };
  }
}
