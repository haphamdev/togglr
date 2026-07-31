import { Controller, Get, HttpException, HttpStatus, Inject } from "@nestjs/common";
import { Public } from "../common/public.decorator";
import { type HealthResult, HealthService } from "./health.service";

/**
 * GET /healthz — unauthenticated liveness/readiness probe. No session/CSRF guard
 * applies, so it never returns 401/403 (togglr-api.md:88). Healthy → 200;
 * any dependency down → 503 with the same degraded body (api:102-103).
 */
@Public()
@Controller("healthz")
export class HealthController {
  constructor(@Inject(HealthService) private readonly health: HealthService) {}

  @Get()
  async check(): Promise<HealthResult> {
    const result = await this.health.check();
    if (result.status !== "ok") {
      throw new HttpException(result, HttpStatus.SERVICE_UNAVAILABLE);
    }
    return result;
  }
}
