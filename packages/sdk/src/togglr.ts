import { evaluate as coreEvaluate } from "@togglr/eval-core";
import type { EvaluationContext, EvaluationResult, Variation } from "@togglr/shared-types";
import { RulesetCache } from "./cache";
import { type ResolvedConfig, resolveConfig, type TogglrConfig } from "./config";
import { fetchRuleset, RulesetSchemaError } from "./transport";

/**
 * The public SDK client. Construction kicks off a non-blocking first ruleset fetch and
 * returns immediately — the host boot is never gated on the network. Readiness flips on
 * the first successful fetch; `waitForReady` lets callers optionally await it (bounded,
 * never rejecting), and `close()` tears down every live handle.
 *
 * Polling, resilience/backoff, evaluate, and telemetry are layered on in later tasks; this
 * class owns the lifecycle seam (`#refresh`, `#timer`, `#abort`, ready-waiters) they hook.
 */
/**
 * Internal, undocumented constructor seam for test determinism. Not re-exported from the
 * package entry point; production callers pass only {@link TogglrConfig}.
 */
export interface TogglrInternals {
  random?: () => number;
}

export class Togglr {
  #config: ResolvedConfig;
  #cache = new RulesetCache();
  #ready = false;
  #closed = false;
  #abort = new AbortController();
  #timer?: NodeJS.Timeout;
  #readyWaiters = new Set<() => void>();
  #random: () => number;
  #failures = 0;
  #schemaWarned = false;

  constructor(config: TogglrConfig, internals: TogglrInternals = {}) {
    this.#config = resolveConfig(config);
    this.#random = internals.random ?? Math.random;
    // Fire-and-forget: bootstrap runs in the background, never awaited here.
    void this.#refresh();
  }

  /**
   * One conditional fetch + forward-only swap, then reschedule the next poll.
   *
   * Success (200 or 304): clear the failure counter, reset the schema-warn dedupe, mark
   * ready, and poll again at the normal cadence — a newer 200 heals any missed changes.
   * Failure: never clear the cache (last-known keeps serving), count the failure, log
   * (schema errors deduped to once), and reschedule with exponential backoff + jitter.
   */
  async #refresh(): Promise<void> {
    if (this.#closed) return;
    try {
      const result = await fetchRuleset(this.#config, {
        etag: this.#cache.etag,
        signal: this.#abort.signal,
      });
      if (result.status === 200) this.#cache.set(result.ruleset, result.etag);
      this.#failures = 0;
      this.#schemaWarned = false;
      this.#markReady();
      this.#scheduleNext(this.#config.pollIntervalMs);
    } catch (err) {
      if (this.#closed) return;
      this.#failures += 1;
      if (err instanceof RulesetSchemaError) {
        if (!this.#schemaWarned) {
          this.#config.logger.warn("ruleset schema unsupported; holding last-known", err);
          this.#schemaWarned = true;
        }
      } else {
        this.#config.logger.warn("ruleset refresh failed", err);
      }
      this.#scheduleNext(this.#backoffDelay());
    }
  }

  /** Full-jitter exponential backoff: random() * min(cap, base * 2^(failures - 1)). */
  #backoffDelay(): number {
    return this.#random() * Math.min(60_000, 1_000 * 2 ** (this.#failures - 1));
  }

  #scheduleNext(delayMs: number): void {
    if (this.#closed) return;
    this.#timer = setTimeout(() => void this.#refresh(), delayMs);
    this.#timer.unref?.();
  }

  #markReady(): void {
    this.#ready = true;
    for (const resolve of this.#readyWaiters) resolve();
    this.#readyWaiters.clear();
  }

  /**
   * Resolve once the SDK has a ruleset, or after `timeout` ms — whichever comes first.
   * Never rejects: at the deadline it resolves anyway and the background refresh keeps
   * trying. Already ready (or closed) → resolves immediately.
   */
  waitForReady({ timeout = 5_000 }: { timeout?: number } = {}): Promise<void> {
    if (this.#ready || this.#closed) return Promise.resolve();
    const { promise, resolve } = Promise.withResolvers<void>();
    const finish = (): void => {
      clearTimeout(timer);
      this.#readyWaiters.delete(finish);
      resolve();
    };
    const timer = setTimeout(finish, timeout);
    timer.unref?.();
    this.#readyWaiters.add(finish);
    return promise;
  }

  /**
   * Evaluate a flag against the cached ruleset, returning its bare {@link Variation}.
   * Never throws into the host: an empty/absent cache or any internal error falls back to
   * `defaultValue`. The full reason matrix (SDK_NOT_READY / FLAG_NOT_FOUND / FLAG_OFF /
   * MISSING_KEY / …) is produced by `@togglr/eval-core`, not reimplemented here.
   */
  evaluate(flagKey: string, context: EvaluationContext, defaultValue: Variation): Variation {
    return this.#run(flagKey, context, defaultValue, false).value;
  }

  /**
   * Boolean-typed convenience over {@link evaluate}. If the resolved variation is not a
   * boolean (only possible once multivariate lands), falls back to `defaultValue` with a
   * `TYPE_MISMATCH` reason. Dormant in the boolean-only MVP.
   */
  evaluateBool(flagKey: string, context: EvaluationContext, defaultValue: boolean): boolean {
    return this.#run(flagKey, context, defaultValue, true).value;
  }

  #run(
    flagKey: string,
    context: EvaluationContext,
    defaultValue: Variation,
    typed: boolean,
  ): EvaluationResult {
    try {
      const result = coreEvaluate(this.#cache.get(), flagKey, context, defaultValue);
      if (typed && typeof result.value !== "boolean") {
        return { value: defaultValue, reason: "TYPE_MISMATCH" };
      }
      return result;
    } catch (err) {
      this.#config.logger.warn("evaluate failed", err);
      return { value: defaultValue, reason: "SDK_NOT_READY" };
    }
  }

  /**
   * Tear down: stop future fetches, abort the in-flight one, clear the poll timer, and
   * release any pending `waitForReady`. Idempotent-safe; leaves no live togglr timer.
   */
  close(): void {
    this.#closed = true;
    this.#abort.abort();
    clearTimeout(this.#timer);
    for (const resolve of this.#readyWaiters) resolve();
    this.#readyWaiters.clear();
  }
}
