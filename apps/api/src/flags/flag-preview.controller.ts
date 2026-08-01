import {
  Body,
  Controller,
  HttpCode,
  Inject,
  Param,
  Post,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import type { EvaluationContext, EvaluationResult } from "@togglr/shared-types";
import { z } from "zod";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { OrgContextGuard } from "../org/org-context.guard";
import { RolesGuard } from "../org/roles.guard";
import { TransactionInterceptor } from "../org/tenant/transaction.interceptor";
import { FlagPreviewService } from "./flag-preview.service";

// Shallow on `config.rules` so deep rule errors surface as CURIOUS_CAT from the service, not
// CLUMSY_OWL from the pipe. Missing `defaultValue` → CLUMSY_OWL. `config`, when present, requires
// all three fields.
const PreviewSchema = z.object({
  context: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
  defaultValue: z.boolean(),
  config: z
    .object({
      enabled: z.boolean(),
      defaultVariation: z.boolean(),
      rules: z.array(z.unknown()),
    })
    .optional(),
});
type PreviewBody = z.infer<typeof PreviewSchema>;

@Controller("orgs/:orgSlug/projects/:projectKey/flags/:flagKey/environments/:envKey/preview")
@UseGuards(OrgContextGuard, RolesGuard)
@UseInterceptors(TransactionInterceptor)
export class FlagPreviewController {
  constructor(@Inject(FlagPreviewService) private readonly preview: FlagPreviewService) {}

  // No @Roles ⇒ any member may preview (RolesGuard: absent decorator = member-level). Response is
  // the raw EvaluationResult, unwrapped.
  @Post()
  @HttpCode(200)
  async run(
    @Param("projectKey") projectKey: string,
    @Param("flagKey") flagKey: string,
    @Param("envKey") envKey: string,
    @Body(new ZodValidationPipe(PreviewSchema)) body: PreviewBody,
  ): Promise<EvaluationResult> {
    return this.preview.preview(projectKey, flagKey, envKey, {
      context: body.context as EvaluationContext,
      defaultValue: body.defaultValue,
      config: body.config,
    });
  }
}
