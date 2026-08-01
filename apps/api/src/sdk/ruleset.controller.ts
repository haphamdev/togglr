import {
  Controller,
  Get,
  Headers,
  Inject,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import type { Ruleset } from "@togglr/shared-types";
import type { Response } from "express";
import type { AuthedRequest } from "../auth/authed-request";
import { DomainException } from "../common/domain-exception";
import { Public } from "../common/public.decorator";
import { SdkKeyGuard } from "../org/sdk-keys/sdk-key.guard";
import { TransactionInterceptor } from "../org/tenant/transaction.interceptor";
import { RulesetService } from "./ruleset.service";

/**
 * SDK hot-path ruleset delivery. Unprefixed (`/sdk/v1/ruleset`, excluded from the
 * `api/v1` global prefix) and `@Public()` so the global SessionGuard/CsrfGuard step
 * aside — authentication is the `Authorization: Bearer <key>` handled by
 * {@link SdkKeyGuard}, which sets `req.sdkEnvironmentId`. The ETag is the
 * environment's monotonic ruleset version, so a matching `If-None-Match` is a cheap
 * `304`.
 */
@Controller("sdk/v1/ruleset")
@Public()
@UseGuards(SdkKeyGuard)
@UseInterceptors(TransactionInterceptor)
export class RulesetController {
  constructor(@Inject(RulesetService) private readonly ruleset: RulesetService) {}

  @Get()
  async get(
    @Req() req: AuthedRequest,
    @Headers("if-none-match") inm: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Ruleset | undefined> {
    const envId = req.sdkEnvironmentId;
    if (!envId) throw new DomainException("BLIND_BAT", 401, "Missing or invalid SDK key");
    const ruleset = await this.ruleset.assemble(envId);
    const etag = `"${ruleset.version}"`;
    res.setHeader("ETag", etag);
    if (inm === etag) {
      res.status(304);
      return undefined;
    }
    return ruleset;
  }
}
