import type { Ruleset } from "@togglr/shared-types";
import { describe, expect, it } from "vitest";
import { RulesetCache } from "./cache";

function ruleset(version: number): Ruleset {
  return { environmentId: "env-1", version, schemaVersion: 1, flags: [] };
}

describe("RulesetCache", () => {
  it("is empty before the first set", () => {
    const cache = new RulesetCache();
    expect(cache.get()).toBeUndefined();
    expect(cache.etag).toBeUndefined();
  });

  it("stores the first ruleset and its etag", () => {
    const cache = new RulesetCache();
    const rs = ruleset(1);
    expect(cache.set(rs, '"1"')).toBe(true);
    expect(cache.get()).toBe(rs);
    expect(cache.etag).toBe('"1"');
  });

  it("swaps in a strictly-newer version", () => {
    const cache = new RulesetCache();
    cache.set(ruleset(1), '"1"');
    const newer = ruleset(2);
    expect(cache.set(newer, '"2"')).toBe(true);
    expect(cache.get()).toBe(newer);
    expect(cache.etag).toBe('"2"');
  });

  it("ignores an equal version", () => {
    const cache = new RulesetCache();
    const first = ruleset(2);
    cache.set(first, '"2"');
    expect(cache.set(ruleset(2), '"2-new"')).toBe(false);
    expect(cache.get()).toBe(first);
    expect(cache.etag).toBe('"2"');
  });

  it("ignores an older version", () => {
    const cache = new RulesetCache();
    const first = ruleset(5);
    cache.set(first, '"5"');
    expect(cache.set(ruleset(3), '"3"')).toBe(false);
    expect(cache.get()).toBe(first);
    expect(cache.etag).toBe('"5"');
  });
});
