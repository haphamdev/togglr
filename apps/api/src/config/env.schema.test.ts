import { describe, expect, it } from "vitest";
import { validate } from "./env.schema";

const fullEnv = {
  DATABASE_URL: "postgres://togglr_app:pw@localhost:5432/togglr",
  REDIS_URL: "redis://localhost:6379",
  PORT: "3000",
};

describe("validate", () => {
  it("throws an error naming DATABASE_URL when it is missing", () => {
    const raw = {
      REDIS_URL: fullEnv.REDIS_URL,
      PORT: fullEnv.PORT,
    };
    expect(() => validate(raw)).toThrow(/DATABASE_URL/);
  });

  it("returns a typed config object with a coerced numeric PORT", () => {
    const config = validate(fullEnv);
    expect(config.PORT).toBe(3000);
    expect(typeof config.PORT).toBe("number");
    expect(config.DATABASE_URL).toBe(fullEnv.DATABASE_URL);
    expect(config.REDIS_URL).toBe(fullEnv.REDIS_URL);
  });

  it("defaults PORT to 3000 when unset", () => {
    const raw = {
      DATABASE_URL: fullEnv.DATABASE_URL,
      REDIS_URL: fullEnv.REDIS_URL,
    };
    expect(validate(raw).PORT).toBe(3000);
  });

  it("applies pool defaults when the DB_POOL_* vars are unset", () => {
    const config = validate(fullEnv);
    expect(config.DB_POOL_MAX).toBe(10);
    expect(config.DB_POOL_CONNECTION_TIMEOUT_MS).toBe(5000);
    expect(config.DB_POOL_IDLE_TIMEOUT_MS).toBe(10000);
  });

  it("coerces provided DB_POOL_* values to numbers", () => {
    const config = validate({ ...fullEnv, DB_POOL_MAX: "20", DB_POOL_IDLE_TIMEOUT_MS: "0" });
    expect(config.DB_POOL_MAX).toBe(20);
    expect(config.DB_POOL_IDLE_TIMEOUT_MS).toBe(0);
  });
});
