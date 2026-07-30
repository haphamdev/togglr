import { HttpException, HttpStatus } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { HealthController } from "./health.controller";
import type { HealthResult, HealthService } from "./health.service";

function controllerWith(result: HealthResult): HealthController {
  const stub = { check: async () => result } as unknown as HealthService;
  return new HealthController(stub);
}

describe("HealthController", () => {
  it("returns the body with 200 semantics when healthy", async () => {
    const body: HealthResult = { status: "ok", checks: { postgres: true, redis: true } };
    await expect(controllerWith(body).check()).resolves.toEqual(body);
  });

  it("throws a 503 carrying the degraded body when any dependency is down", async () => {
    const body: HealthResult = { status: "degraded", checks: { postgres: false, redis: true } };
    try {
      await controllerWith(body).check();
      expect.unreachable("expected a 503 to be thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      const http = error as HttpException;
      expect(http.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      expect(http.getResponse()).toEqual(body);
    }
  });
});
