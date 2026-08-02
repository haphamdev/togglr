/** Host-supplied logging seam. The SDK writes nothing to stdout uninvited. */
export interface Logger {
  warn(message: string, meta?: unknown): void;
}

/** Public configuration accepted by `new Togglr(config)`. Only `sdkKey` is required. */
export interface TogglrConfig {
  sdkKey: string;
  baseUrl?: string;
  /** Background poll cadence in ms. Default 30_000; must be >= 1000 when provided. */
  pollIntervalMs?: number;
  /** Per-request timeout in ms. Default 5_000; must be >= 1 when provided. */
  requestTimeoutMs?: number;
  logger?: Logger;
}

/** All-required internal mirror of {@link TogglrConfig} after defaults are applied. */
export interface ResolvedConfig {
  sdkKey: string;
  baseUrl: string;
  pollIntervalMs: number;
  requestTimeoutMs: number;
  logger: Logger;
}

/** Default logger: swallows everything so the SDK is silent unless a logger is passed. */
export const SILENT_LOGGER: Logger = { warn() {} };

/**
 * Validate + fill defaults. Construction is the only place the SDK throws: a falsy
 * `sdkKey` or an out-of-range numeric option is a programmer error caught up front, not a
 * runtime condition to swallow. The `!(x >= floor)` form also rejects `NaN`.
 */
export function resolveConfig(config: TogglrConfig): ResolvedConfig {
  if (!config.sdkKey) throw new Error("Togglr: sdkKey is required");
  if (config.pollIntervalMs !== undefined && !(config.pollIntervalMs >= 1_000)) {
    throw new Error("Togglr: pollIntervalMs must be >= 1000");
  }
  if (config.requestTimeoutMs !== undefined && !(config.requestTimeoutMs >= 1)) {
    throw new Error("Togglr: requestTimeoutMs must be >= 1");
  }
  return {
    sdkKey: config.sdkKey,
    baseUrl: config.baseUrl ?? "http://localhost:3100",
    pollIntervalMs: config.pollIntervalMs ?? 30_000,
    requestTimeoutMs: config.requestTimeoutMs ?? 5_000,
    logger: config.logger ?? SILENT_LOGGER,
  };
}
