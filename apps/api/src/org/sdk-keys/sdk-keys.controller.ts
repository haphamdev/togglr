import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import type { SdkKey, SdkKeySecret } from "@togglr/shared-types";
import { z } from "zod";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { OrgContextGuard } from "../org-context.guard";
import { Roles } from "../roles.decorator";
import { RolesGuard } from "../roles.guard";
import { TransactionInterceptor } from "../tenant/transaction.interceptor";
import { SdkKeyService } from "./sdk-key.service";

const IssueKeySchema = z.object({ name: z.string().optional() });
type IssueKeyBody = z.infer<typeof IssueKeySchema>;

/** SDK key management for an environment. All routes are admin-gated. */
@Controller("orgs/:orgSlug/projects/:projectKey/environments/:envKey/keys")
@UseGuards(OrgContextGuard, RolesGuard)
@UseInterceptors(TransactionInterceptor)
export class SdkKeysController {
  constructor(@Inject(SdkKeyService) private readonly keys: SdkKeyService) {}

  @Post()
  @Roles("admin")
  @HttpCode(201)
  async issue(
    @Param("projectKey") projectKey: string,
    @Param("envKey") envKey: string,
    @Body(new ZodValidationPipe(IssueKeySchema)) body: IssueKeyBody,
  ): Promise<SdkKeySecret> {
    return this.keys.issue(projectKey, envKey, body.name ?? null);
  }

  @Get()
  @Roles("admin")
  async list(
    @Param("projectKey") projectKey: string,
    @Param("envKey") envKey: string,
  ): Promise<{ keys: SdkKey[] }> {
    return { keys: await this.keys.list(projectKey, envKey) };
  }

  @Post(":keyId/rotate")
  @Roles("admin")
  @HttpCode(201)
  async rotate(
    @Param("projectKey") projectKey: string,
    @Param("envKey") envKey: string,
    @Param("keyId") keyId: string,
  ): Promise<{
    newKey: SdkKeySecret;
    rotatedKey: { id: string; status: "active"; expiresAt: string };
  }> {
    return this.keys.rotate(projectKey, envKey, keyId);
  }

  @Delete(":keyId")
  @Roles("admin")
  @HttpCode(204)
  async revoke(
    @Param("projectKey") projectKey: string,
    @Param("envKey") envKey: string,
    @Param("keyId") keyId: string,
  ): Promise<void> {
    await this.keys.revoke(projectKey, envKey, keyId);
  }
}
