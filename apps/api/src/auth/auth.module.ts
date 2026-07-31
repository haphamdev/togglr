import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { OrgModule } from "../org/org.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { CsrfGuard } from "./guards/csrf.guard";
import { SessionGuard } from "./guards/session.guard";
import { PasswordService } from "./password.service";
import { SessionService } from "./session.service";

/**
 * Auth & Sessions. Owns sign-up/login/logout, `/auth/me`, the Redis session
 * store, and the global SessionGuard + CsrfGuard. The guards are registered
 * Session-before-Csrf: Nest runs same-module APP_GUARDs in array order, so
 * `request.session` is set before CsrfGuard reads it.
 */
@Module({
  imports: [OrgModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionService,
    PasswordService,
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
  ],
})
export class AuthModule {}
