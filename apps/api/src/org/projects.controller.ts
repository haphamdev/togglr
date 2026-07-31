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
import type { Environment, Project } from "@togglr/shared-types";
import { z } from "zod";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { OrgContextGuard } from "./org-context.guard";
import { ProjectsService } from "./projects.service";
import { Roles } from "./roles.decorator";
import { RolesGuard } from "./roles.guard";
import { TransactionInterceptor } from "./tenant/transaction.interceptor";

const CreateProjectSchema = z.object({
  key: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
});
type CreateProjectBody = z.infer<typeof CreateProjectSchema>;

const RenameSchema = z.object({ name: z.string().min(1) });
type RenameBody = z.infer<typeof RenameSchema>;

@Controller("orgs/:orgSlug/projects")
@UseGuards(OrgContextGuard, RolesGuard)
@UseInterceptors(TransactionInterceptor)
export class ProjectsController {
  constructor(@Inject(ProjectsService) private readonly projects: ProjectsService) {}

  @Post()
  @Roles("admin")
  @HttpCode(201)
  async create(
    @Body(new ZodValidationPipe(CreateProjectSchema)) body: CreateProjectBody,
  ): Promise<{ project: Project; environments: Environment[] }> {
    return this.projects.create(body);
  }

  @Get()
  async list(): Promise<{ projects: Project[] }> {
    return { projects: await this.projects.list() };
  }

  @Get(":projectKey")
  async detail(@Param("projectKey") projectKey: string): Promise<{ project: Project }> {
    return { project: await this.projects.get(projectKey) };
  }

  @Patch(":projectKey")
  @Roles("admin")
  async rename(
    @Param("projectKey") projectKey: string,
    @Body(new ZodValidationPipe(RenameSchema)) body: RenameBody,
  ): Promise<{ project: Project }> {
    return { project: await this.projects.rename(projectKey, body.name) };
  }
}
