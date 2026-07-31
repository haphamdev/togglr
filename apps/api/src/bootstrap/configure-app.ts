import { type INestApplication, RequestMethod } from "@nestjs/common";

/**
 * Applies runtime app config shared by `main.ts` and integration tests: the
 * global `api/v1` route prefix (matching the web client's API_BASE and the API
 * doc's control-plane base, togglr-api.md:30), excluding `/healthz` which stays
 * unprefixed as an infra-level probe.
 *
 * Kept out of `main.ts` so supertest-based tests can build a NestApplication and
 * apply the identical prefix before `app.init()`.
 */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix("api/v1", {
    exclude: [{ path: "healthz", method: RequestMethod.ALL }],
  });
}
