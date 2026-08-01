import type { Ruleset } from "@togglr/shared-types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Togglr } from "./togglr";
import type * as TransportModule from "./transport";
import { RulesetSchemaError } from "./transport";

const { fetchRulesetMock } = vi.hoisted(() => ({ fetchRulesetMock: vi.fn() }));

vi.mock("./transport", async (importOriginal) => {
  const actual = await importOriginal<typeof TransportModule>();
  return { ...actual, fetchRuleset: fetchRulesetMock };
});

function emptyRuleset(version: number): Ruleset {
  return { environmentId: "env-1", version, schemaVersion: 1, flags: [] };
}

function flagRuleset(version: number, defaultVariation: boolean): Ruleset {
  return {
    environmentId: "env-1",
    version,
    schemaVersion: 1,
    flags: [{ key: "flag", type: "boolean", enabled: true, defaultVariation, rules: [] }],
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  fetchRulesetMock.mockReset();
});

afterEach(() => vi.useRealTimers());

describe("Togglr resilience", () => {
  it("keeps serving last-known values after a fetch error (AC1/AC3)", async () => {
    fetchRulesetMock
      .mockResolvedValueOnce({ status: 200, ruleset: flagRuleset(1, true), etag: '"1"' })
      .mockRejectedValue(new Error("network down"));
    const t = new Togglr({ sdkKey: "sk" }, { random: () => 1 });

    await vi.advanceTimersByTimeAsync(0);
    expect(t.evaluate("flag", { key: "u" }, false)).toBe(true);

    await vi.advanceTimersByTimeAsync(30_000); // poll fails
    expect(() => t.evaluate("flag", { key: "u" }, false)).not.toThrow();
    expect(t.evaluate("flag", { key: "u" }, false)).toBe(true); // last-known holds
    t.close();
  });

  it("widens the retry delay on consecutive failures (AC4)", async () => {
    fetchRulesetMock
      .mockResolvedValueOnce({ status: 200, ruleset: emptyRuleset(1), etag: '"1"' })
      .mockRejectedValue(new Error("down"));
    // random() => 1 makes the full-jitter delay equal its upper bound: 1000 * 2^(n-1).
    const t = new Togglr({ sdkKey: "sk" }, { random: () => 1 });

    await vi.advanceTimersByTimeAsync(0); // bootstrap ok → poll scheduled at 30_000
    await vi.advanceTimersByTimeAsync(30_000); // poll #1 fails → failures=1, backoff 1000
    expect(fetchRulesetMock).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(999);
    expect(fetchRulesetMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1); // failures=2, backoff 2000
    expect(fetchRulesetMock).toHaveBeenCalledTimes(3);

    await vi.advanceTimersByTimeAsync(1999);
    expect(fetchRulesetMock).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(1); // failures=3, backoff 4000
    expect(fetchRulesetMock).toHaveBeenCalledTimes(4);
    t.close();
  });

  it("resets to the poll interval after recovery (AC5)", async () => {
    fetchRulesetMock
      .mockResolvedValueOnce({ status: 200, ruleset: emptyRuleset(1), etag: '"1"' })
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValueOnce({ status: 200, ruleset: emptyRuleset(2), etag: '"2"' })
      .mockResolvedValue({ status: 304 });
    const t = new Togglr({ sdkKey: "sk" }, { random: () => 1 });

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(30_000); // poll fails → backoff 1000
    expect(fetchRulesetMock).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(1_000); // recovers → resets to 30_000 cadence
    expect(fetchRulesetMock).toHaveBeenCalledTimes(3);

    await vi.advanceTimersByTimeAsync(29_999);
    expect(fetchRulesetMock).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchRulesetMock).toHaveBeenCalledTimes(4);
    t.close();
  });

  it("treats a per-fetch timeout as an error and holds last-known (AC6)", async () => {
    fetchRulesetMock
      .mockResolvedValueOnce({ status: 200, ruleset: flagRuleset(1, true), etag: '"1"' })
      .mockRejectedValue(new DOMException("timed out", "TimeoutError"));
    const warn = vi.fn();
    const t = new Togglr({ sdkKey: "sk", logger: { warn } }, { random: () => 1 });

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(30_000); // times out

    expect(t.evaluate("flag", { key: "u" }, false)).toBe(true);
    expect(warn).toHaveBeenCalledWith("ruleset refresh failed", expect.any(DOMException));
    t.close();
  });

  it("holds last-known and warns once on repeated schema errors (AC7)", async () => {
    fetchRulesetMock
      .mockResolvedValueOnce({ status: 200, ruleset: flagRuleset(1, true), etag: '"1"' })
      .mockRejectedValue(new RulesetSchemaError("schemaVersion 2"));
    const warn = vi.fn();
    const t = new Togglr({ sdkKey: "sk", logger: { warn } }, { random: () => 1 });

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(30_000); // poll #1 → warn once
    await vi.advanceTimersByTimeAsync(1_000); // poll #2 → deduped
    await vi.advanceTimersByTimeAsync(2_000); // poll #3 → deduped

    const schemaWarns = warn.mock.calls.filter(([message]) => message.includes("schema"));
    expect(schemaWarns).toHaveLength(1);
    expect(t.evaluate("flag", { key: "u" }, false)).toBe(true);
    t.close();
  });

  it("heals the cache when a newer 200 arrives after a failure (AC2/AC5)", async () => {
    fetchRulesetMock
      .mockResolvedValueOnce({ status: 200, ruleset: flagRuleset(1, true), etag: '"1"' })
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValueOnce({ status: 200, ruleset: flagRuleset(2, false), etag: '"2"' });
    const t = new Togglr({ sdkKey: "sk" }, { random: () => 1 });

    await vi.advanceTimersByTimeAsync(0);
    expect(t.evaluate("flag", { key: "u" }, true)).toBe(true); // v1 default

    await vi.advanceTimersByTimeAsync(30_000); // fails → backoff 1000
    await vi.advanceTimersByTimeAsync(1_000); // recovery v2 swaps in

    expect(t.evaluate("flag", { key: "u" }, true)).toBe(false); // healed to v2 default
    t.close();
  });
});
