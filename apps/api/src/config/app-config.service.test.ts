import { describe, expect, it } from "vitest";
import { AppConfigService } from "./app-config.service";

/** Build the service over a fake ConfigService backed by a plain map. */
function svc(values: Record<string, unknown>): AppConfigService {
  return new AppConfigService({ get: (key: string) => values[key] } as never);
}

describe("AppConfigService.dbPoolOptions", () => {
  it("maps validated pool settings onto pg Pool option names", () => {
    const options = svc({
      DB_POOL_MAX: 20,
      DB_POOL_CONNECTION_TIMEOUT_MS: 3000,
      DB_POOL_IDLE_TIMEOUT_MS: 15000,
    }).dbPoolOptions;

    expect(options).toEqual({
      max: 20,
      connectionTimeoutMillis: 3000,
      idleTimeoutMillis: 15000,
    });
  });
});
