import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res } from "@nestjs/common";
import type { Response } from "express";
import { z } from "zod";
import { DomainException } from "../common/domain-exception";
import { Public } from "../common/public.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { AppConfigService } from "../config/app-config.service";
import { AuthService, type PublicUser } from "./auth.service";
import type { AuthedRequest } from "./authed-request";
import { SessionService } from "./session.service";

/** Org-owned; the seam returns [] until the Org Workspace epic ships memberships. */
type Membership = { slug: string; name: string; role: string };

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

@Controller("auth")
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(AppConfigService) private readonly config: AppConfigService,
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
    return { user, memberships: [], csrfToken: session.csrfToken };
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
    return { user, memberships: [], csrfToken };
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
