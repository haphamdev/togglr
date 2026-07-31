import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from "@nestjs/common";
import type { Response } from "express";
import { DomainException } from "./domain-exception";

/**
 * Global exception filter rendering the control-plane error envelope
 * `{ error: { code, message } }` (togglr-api.md:52-53).
 *
 * - DomainException → its `status` + `{ error: { code, message } }`.
 * - Any other HttpException → passed through UNCHANGED (original status + body),
 *   so /healthz's degraded `{ status, checks }` body is preserved verbatim.
 * - Anything else → 500 with an opaque `INTERNAL` envelope; the underlying error
 *   is logged, never leaked (no 5xx animal code exists — cp:120-121).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof DomainException) {
      res
        .status(exception.status)
        .json({ error: { code: exception.code, message: exception.message } });
      return;
    }

    if (exception instanceof HttpException) {
      // Preserve framework/handler responses as-is (e.g. HealthController's 503
      // { status, checks }). These already carry their intended status + body.
      res.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    res.status(500).json({ error: { code: "INTERNAL", message: "Internal server error" } });
  }
}
