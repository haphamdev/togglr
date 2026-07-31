import { type CanActivate, type ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { OrgRole } from "@togglr/shared-types";
import type { AuthedRequest } from "../auth/authed-request";
import { DomainException } from "../common/domain-exception";
import { ROLES_KEY } from "./roles.decorator";

const RANK: Record<OrgRole, number> = { member: 1, admin: 2, owner: 3 };

/**
 * Enforces the `@Roles(min)` minimum against `req.orgContext.role` (set by
 * OrgContextGuard, which runs first). A role below the minimum is `403
 * SNEAKY_OWL`. No `@Roles` metadata ⇒ any member may proceed.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const min = this.reflector.getAllAndOverride<OrgRole | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!min) return true;

    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const role = req.orgContext?.role;
    if (!role || RANK[role] < RANK[min]) {
      throw new DomainException("SNEAKY_OWL", 403, "Insufficient role for this action");
    }
    return true;
  }
}
