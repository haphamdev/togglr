/** Host-supplied logging seam. The SDK writes nothing to stdout uninvited. */
export interface Logger {
  warn(message: string, meta?: unknown): void;
}

/** Public configuration accepted by `new Togglr(config)`. Only `sdkKey` is required. */
export interface TogglrConfig {
  sdkKey: string;
  baseUrl?: string;
  pollIntervalMs?: number;
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
 * Validate + fill defaults. The only place the SDK throws on construction: a falsy
 * `sdkKey` is a programmer error, not a runtime condition to swallow.
 */
export function resolveConfig(config: TogglrConfig): ResolvedConfig {
  if (!config.sdkKey) throw new Error("Togglr: sdkKey is required");
  return {
    sdkKey: config.sdkKey,
    baseUrl: config.baseUrl ?? "http://localhost:3100",
    pollIntervalMs: config.pollIntervalMs ?? 30_000,
    requestTimeoutMs: config.requestTimeoutMs ?? 5_000,
    logger: config.logger ?? SILENT_LOGGER,
  };
}
