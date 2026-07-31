import { type CanActivate, type ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { DomainException } from "../../common/domain-exception";
import { IS_PUBLIC } from "../../common/public.decorator";
import { type AuthedRequest, parseCookie } from "../authed-request";
import { SessionService } from "../session.service";

const SESSION_COOKIE = "togglr_session";

/**
 * Global guard resolving the session for every non-`@Public()` route. Reads the
 * `togglr_session` cookie → SessionService.read (which refreshes the idle TTL);
 * a missing/invalid/expired session is `401 SLEEPY_OWL`. On success attaches
 * `request.session` + `request.sessionToken` for downstream handlers/CsrfGuard.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(SessionService) private readonly sessions: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const token = parseCookie(request.headers.cookie, SESSION_COOKIE);
    const record = token ? await this.sessions.read(token) : null;
    if (!record) {
      throw new DomainException("SLEEPY_OWL", 401, "Missing or invalid session");
    }

    request.session = record;
    request.sessionToken = token;
    return true;
  }
}
