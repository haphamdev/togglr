import { evaluate as coreEvaluate } from "@togglr/eval-core";
import type { EvaluationContext, EvaluationResult, Variation } from "@togglr/shared-types";
import { RulesetCache } from "./cache";
import { type ResolvedConfig, resolveConfig, type TogglrConfig } from "./config";
import { fetchRuleset } from "./transport";

/**
 * The public SDK client. Construction kicks off a non-blocking first ruleset fetch and
 * returns immediately — the host boot is never gated on the network. Readiness flips on
 * the first successful fetch; `waitForReady` lets callers optionally await it (bounded,
 * never rejecting), and `close()` tears down every live handle.
 *
 * Polling, resilience/backoff, evaluate, and telemetry are layered on in later tasks; this
 * class owns the lifecycle seam (`#refresh`, `#timer`, `#abort`, ready-waiters) they hook.
 */
export class Togglr {
  #config: ResolvedConfig;
  #cache = new RulesetCache();
  #ready = false;
  #closed = false;
  #abort = new AbortController();
  #timer?: NodeJS.Timeout;
  #readyWaiters = new Set<() => void>();

  constructor(config: TogglrConfig) {
    this.#config = resolveConfig(config);
    // Fire-and-forget: bootstrap runs in the background, never awaited here.
    void this.#refresh();
  }

  /**
   * One conditional fetch + forward-only swap. A 200 swaps and marks ready; a 304 means
   * last-known is already current, so it just marks ready. Failures leave readiness as-is
   * (a failed first fetch stays not-ready) and are logged. No rescheduling yet (Task 4).
   */
  async #refresh(): Promise<void> {
    if (this.#closed) return;
    try {
      const result = await fetchRuleset(this.#config, {
        etag: this.#cache.etag,
        signal: this.#abort.signal,
      });
      if (result.status === 200) this.#cache.set(result.ruleset, result.etag);
      this.#markReady();
    } catch (err) {
      if (this.#closed) return;
      this.#config.logger.warn("ruleset refresh failed", err);
    }
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
