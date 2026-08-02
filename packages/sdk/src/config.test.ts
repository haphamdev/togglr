import { describe, expect, it } from "vitest";
import { resolveConfig, SILENT_LOGGER } from "./config";

describe("resolveConfig", () => {
  it("fills defaults for every optional field", () => {
    expect(resolveConfig({ sdkKey: "sk" })).toEqual({
      sdkKey: "sk",
      baseUrl: "http://localhost:3100",
      pollIntervalMs: 30_000,
      requestTimeoutMs: 5_000,
      logger: SILENT_LOGGER,
    });
  });

  it("keeps caller-provided values that are in range", () => {
    const resolved = resolveConfig({
      sdkKey: "sk",
      baseUrl: "https://api.example.com",
      pollIntervalMs: 1_000,
      requestTimeoutMs: 1,
      logger: SILENT_LOGGER,
    });
    expect(resolved.baseUrl).toBe("https://api.example.com");
    expect(resolved.pollIntervalMs).toBe(1_000);
    expect(resolved.requestTimeoutMs).toBe(1);
  });

  it("throws when sdkKey is missing", () => {
    expect(() => resolveConfig({ sdkKey: "" })).toThrow("sdkKey is required");
  });

  it("throws when pollIntervalMs is below the floor", () => {
    expect(() => resolveConfig({ sdkKey: "sk", pollIntervalMs: 999 })).toThrow(
      "pollIntervalMs must be >= 1000",
    );
    expect(() => resolveConfig({ sdkKey: "sk", pollIntervalMs: 0 })).toThrow(
      "pollIntervalMs must be >= 1000",
    );
  });

  it("throws when requestTimeoutMs is below the floor", () => {
    expect(() => resolveConfig({ sdkKey: "sk", requestTimeoutMs: 0 })).toThrow(
      "requestTimeoutMs must be >= 1",
    );
  });

  it("rejects NaN numeric options", () => {
    expect(() => resolveConfig({ sdkKey: "sk", pollIntervalMs: Number.NaN })).toThrow(
      "pollIntervalMs must be >= 1000",
    );
    expect(() => resolveConfig({ sdkKey: "sk", requestTimeoutMs: Number.NaN })).toThrow(
      "requestTimeoutMs must be >= 1",
    );
  });
});
