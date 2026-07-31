import { type CanActivate, type ExecutionContext, Injectable } from "@nestjs/common";
import { DomainException } from "../../common/domain-exception";
import type { AuthedRequest } from "../authed-request";

const MUTATING = new Set(["POST", "PATCH", "PUT", "DELETE"]);

/**
 * Global CSRF guard. Runs after SessionGuard (same-module APP_GUARD order).
 * - No `request.session` → public/bootstrap route with no session; CSRF is moot.
 * - Non-mutating verb (GET/HEAD/OPTIONS) → never checked.
 * - Otherwise the `x-csrf-token` header must equal the session's stored
 *   csrfToken; missing/mismatch is `403 GRUMPY_OWL`.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    if (!request.session) return true;
    if (!MUTATING.has(request.method.toUpperCase())) return true;

    const header = request.headers["x-csrf-token"];
    const provided = Array.isArray(header) ? header[0] : header;
    if (!provided || provided !== request.session.csrfToken) {
      throw new DomainException("GRUMPY_OWL", 403, "Missing or mismatched X-CSRF-Token");
    }
    return true;
  }
}
