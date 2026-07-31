import { type CanActivate, type ExecutionContext, Inject, Injectable } from "@nestjs/common";
import type { AuthedRequest } from "../../auth/authed-request";
import { DomainException } from "../../common/domain-exception";
import { SdkKeyService } from "./sdk-key.service";

/**
 * Authenticates an inbound SDK request by its `Authorization: Bearer <key>`
 * header. A missing/unknown/revoked/expired key is a generic `401 BLIND_BAT`
 * (no distinction, to avoid probing). On success sets `req.orgContext =
 * { orgId, role: "member" }` and `req.sdkEnvironmentId` so the (future) hot path
 * runs under the tenant transaction. No route mounts this in this epic (Ruleset
 * Delivery will); it is tested directly.
 */
@Injectable()
export class SdkKeyGuard implements CanActivate {
  constructor(@Inject(SdkKeyService) private readonly keys: SdkKeyService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization;
    const presented = header?.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : null;
    if (!presented) throw new DomainException("BLIND_BAT", 401, "Missing or invalid SDK key");

    const resolved = await this.keys.validate(presented);
    if (!resolved) throw new DomainException("BLIND_BAT", 401, "Missing or invalid SDK key");

    req.orgContext = { orgId: resolved.orgId, role: "member" };
    req.sdkEnvironmentId = resolved.environmentId;
    return true;
  }
}
