import { Body, Controller, Get, HttpCode, Inject, Param, Post, Req, Res } from "@nestjs/common";
import type { InvitePreview, Membership, OrgRole } from "@togglr/shared-types";
import type { Response } from "express";
import { z } from "zod";
import { DomainException } from "../common/domain-exception";
import { Public } from "../common/public.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { AppConfigService } from "../config/app-config.service";
import { InvitesService } from "../org/invites.service";
import { MembershipQueryService } from "../org/membership-query.service";
import { AuthService, type PublicUser } from "./auth.service";
import { type AuthedRequest, parseCookie } from "./authed-request";
import { SessionService } from "./session.service";

const SESSION_COOKIE = "togglr_session";

const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(10),
  name: z.string().optional(),
});
type SignupBody = z.infer<typeof SignupSchema>;

// Presence-only (no .email()): a malformed-but-present email must flow to the
// generic SLY_FOX path, not leak a distinct 400 that reveals it never matched.
const LoginSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});
type LoginBody = z.infer<typeof LoginSchema>;

const AcceptInviteSchema = z.object({
  password: z.string().optional(),
  name: z.string().optional(),
});
type AcceptInviteBody = z.infer<typeof AcceptInviteSchema>;

@Controller("auth")
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(AppConfigService) private readonly config: AppConfigService,
    @Inject(MembershipQueryService) private readonly memberships: MembershipQueryService,
    @Inject(InvitesService) private readonly invites: InvitesService,
  ) {}

  @Post("signup")
  @Public()
  @HttpCode(201)
  async signup(
    @Body(new ZodValidationPipe(SignupSchema)) body: SignupBody,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: PublicUser; csrfToken: string }> {
    const user = await this.auth.signup(body);
    const { token, csrfToken } = await this.sessions.create(user.id);
    this.setSessionCookie(res, token);
    return { user, csrfToken };
  }

  @Get("me")
  async me(
    @Req() req: AuthedRequest,
  ): Promise<{ user: PublicUser; memberships: Membership[]; csrfToken: string }> {
    // SessionGuard guarantees a session on this protected route; guard defensively.
    const session = req.session;
    if (!session) throw new DomainException("SLEEPY_OWL", 401, "Missing or invalid session");
    const user = await this.auth.getUser(session.userId);
    if (!user) throw new DomainException("SLEEPY_OWL", 401, "Missing or invalid session");
    const memberships = await this.memberships.listForUser(session.userId);
    return { user, memberships, csrfToken: session.csrfToken };
  }

  @Post("login")
  @Public()
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(LoginSchema)) body: LoginBody,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: PublicUser; memberships: Membership[]; csrfToken: string }> {
    const user = await this.auth.validateCredentials(body.email, body.password);
    // Identical response for a wrong password and an unknown email — no enumeration.
    if (!user) throw new DomainException("SLY_FOX", 401, "Invalid email or password");
    const { token, csrfToken } = await this.sessions.create(user.id);
    this.setSessionCookie(res, token);
    const memberships = await this.memberships.listForUser(user.id);
    return { user, memberships, csrfToken };
  }

  @Post("logout")
  @HttpCode(204)
  async logout(
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    if (req.sessionToken) await this.sessions.destroy(req.sessionToken);
    res.clearCookie(SESSION_COOKIE, { path: "/" });
  }

  @Post("logout-all")
  @HttpCode(204)
  async logoutAll(
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    // SessionGuard guarantees a session here; revoke every session for the user.
    if (req.session) await this.sessions.destroyAll(req.session.userId);
    res.clearCookie(SESSION_COOKIE, { path: "/" });
  }

  @Get("invites/:token")
  @Public()
  async previewInvite(@Param("token") token: string): Promise<InvitePreview> {
    const invite = await this.invites.resolveOrThrow(token);
    const existing = await this.auth.findByEmail(invite.email);
    return {
      orgName: invite.orgName,
      email: invite.email,
      role: invite.role,
      userExists: existing !== null,
      expiresAt: invite.expiresAt.toISOString(),
    };
  }

  @Post("invites/:token/accept")
  @Public()
  async acceptInvite(
    @Param("token") token: string,
    @Body(new ZodValidationPipe(AcceptInviteSchema)) body: AcceptInviteBody,
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{
    user: { id: string; email: string };
    membership: { slug: string; role: OrgRole };
    csrfToken?: string;
  }> {
    const invite = await this.invites.resolveOrThrow(token);
    const existing = await this.auth.findByEmail(invite.email);

    if (!existing) {
      // New-account path: password required; CSRF-exempt (Public bootstrap).
      if (!body.password) {
        throw new DomainException("SHY_FOX", 400, "Password required to create an account");
      }
      const user = await this.auth.signup({
        email: invite.email,
        password: body.password,
        name: body.name,
      });
      const { token: sessionToken, csrfToken } = await this.sessions.create(user.id);
      this.setSessionCookie(res, sessionToken);
      const { slug } = await this.invites.accept({
        inviteId: invite.id,
        orgId: invite.organizationId,
        userId: user.id,
        role: invite.role,
      });
      res.status(201);
      return {
        user: { id: user.id, email: user.email },
        membership: { slug, role: invite.role },
        csrfToken,
      };
    }

    // Existing-account path: requires a session for the invited user + CSRF.
    const sessionToken = parseCookie(req.headers.cookie, SESSION_COOKIE);
    const record = sessionToken ? await this.sessions.read(sessionToken) : null;
    if (!record) throw new DomainException("SLEEPY_OWL", 401, "Missing or invalid session");
    const sessionUser = await this.auth.getUser(record.userId);
    if (!sessionUser || sessionUser.email !== invite.email) {
      throw new DomainException(
        "PUZZLED_FOX",
        403,
        "Session user does not match the invited email",
      );
    }
    const header = req.headers["x-csrf-token"];
    const provided = Array.isArray(header) ? header[0] : header;
    if (!provided || provided !== record.csrfToken) {
      throw new DomainException("GRUMPY_OWL", 403, "Missing or mismatched X-CSRF-Token");
    }
    const { slug } = await this.invites.accept({
      inviteId: invite.id,
      orgId: invite.organizationId,
      userId: existing.id,
      role: invite.role,
    });
    res.status(200);
    return {
      user: { id: existing.id, email: existing.email },
      membership: { slug, role: invite.role },
    };
  }

  /** Set the httpOnly session cookie; the token lives here, never in the body. */
  private setSessionCookie(res: Response, token: string): void {
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: this.config.cookieSecure,
      sameSite: "lax",
      path: "/",
      maxAge: this.config.sessionIdleTtlS * 1000,
    });
  }
}
