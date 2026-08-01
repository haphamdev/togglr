import type { Ruleset } from "@togglr/shared-types";

/**
 * In-memory holder of the current ruleset with a forward-only atomic swap. A reader
 * always sees a whole ruleset reference (never a half-updated one); a stale/equal
 * version is silently ignored so out-of-order or replayed fetches can't roll back.
 */
export class RulesetCache {
  #current?: Ruleset;
  #currentEtag?: string;

  /** The whole current ruleset reference, or `undefined` before the first swap. */
  get(): Ruleset | undefined {
    return this.#current;
  }

  /** The ETag to echo as the next `If-None-Match`, or `undefined` before the first swap. */
  get etag(): string | undefined {
    return this.#currentEtag;
  }

  /**
   * Swap in `next` only if strictly newer than the cached version. Returns whether the
   * swap happened (`false` = equal/older, ignored).
   */
  set(next: Ruleset, etag: string): boolean {
    if (this.#current && next.version <= this.#current.version) return false;
    this.#current = next;
    this.#currentEtag = etag;
    return true;
  }
}
