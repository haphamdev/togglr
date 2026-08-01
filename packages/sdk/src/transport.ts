import type { Ruleset } from "@togglr/shared-types";
import type { ResolvedConfig } from "./config";

/** Highest ruleset `schemaVersion` this SDK build understands. */
export const SUPPORTED_SCHEMA_VERSION = 1;

/** Any transport-level failure: non-2xx/304 status, network error, or timeout. */
export class RulesetFetchError extends Error {}

/** Payload the SDK cannot trust: unparseable body or a too-new `schemaVersion`. */
export class RulesetSchemaError extends RulesetFetchError {}

/** Discriminated transport outcome. A 304 carries nothing (last-known stays authoritative). */
export type FetchResult = { status: 200; ruleset: Ruleset; etag: string } | { status: 304 };

/**
 * Conditional `GET <baseUrl>/sdk/v1/ruleset` with Bearer auth. Aborts after
 * `requestTimeoutMs` (combined with any caller `signal`); a timeout surfaces as a
 * rejection. Never mutates state — the cache/poll loop own scheduling and swaps.
 */
export async function fetchRuleset(
  config: ResolvedConfig,
  opts?: { etag?: string; signal?: AbortSignal },
): Promise<FetchResult> {
  const timeout = AbortSignal.timeout(config.requestTimeoutMs);
  const signal = opts?.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;
  const headers: Record<string, string> = { Authorization: `Bearer ${config.sdkKey}` };
  if (opts?.etag) headers["If-None-Match"] = opts.etag;

  const res = await fetch(`${config.baseUrl}/sdk/v1/ruleset`, { headers, signal });
  if (res.status === 304) return { status: 304 };
  if (!res.ok) throw new RulesetFetchError(`ruleset fetch ${res.status}`);

  let ruleset: Ruleset;
  try {
    ruleset = (await res.json()) as Ruleset;
  } catch {
    throw new RulesetSchemaError("ruleset body is not valid JSON");
  }
  if (ruleset.schemaVersion > SUPPORTED_SCHEMA_VERSION) {
    throw new RulesetSchemaError(`unsupported schemaVersion ${ruleset.schemaVersion}`);
  }
  return { status: 200, ruleset, etag: res.headers.get("ETag") ?? `"${ruleset.version}"` };
}
