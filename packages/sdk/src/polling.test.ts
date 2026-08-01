import type { Ruleset } from "@togglr/shared-types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RulesetCache } from "./cache";
import { Togglr } from "./togglr";
import type * as TransportModule from "./transport";

const { fetchRulesetMock } = vi.hoisted(() => ({ fetchRulesetMock: vi.fn() }));

vi.mock("./transport", async (importOriginal) => {
  const actual = await importOriginal<typeof TransportModule>();
  return { ...actual, fetchRuleset: fetchRulesetMock };
});

function ruleset(version: number): Ruleset {
  return { environmentId: "env-1", version, schemaVersion: 1, flags: [] };
}

let setSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.useFakeTimers();
  fetchRulesetMock.mockReset();
  setSpy = vi.spyOn(RulesetCache.prototype, "set");
});

afterEach(() => {
  setSpy.mockRestore();
  vi.useRealTimers();
});

describe("Togglr polling", () => {
  it("polls again after pollIntervalMs carrying the current If-None-Match (AC1/AC4)", async () => {
    fetchRulesetMock.mockResolvedValue({ status: 200, ruleset: ruleset(1), etag: '"1"' });
    const t = new Togglr({ sdkKey: "sk" });

    await vi.advanceTimersByTimeAsync(0);
    expect(fetchRulesetMock).toHaveBeenCalledTimes(1);
    expect(fetchRulesetMock.mock.calls[0][1].etag).toBeUndefined();

    await vi.advanceTimersByTimeAsync(30_000);
    expect(fetchRulesetMock).toHaveBeenCalledTimes(2);
    expect(fetchRulesetMock.mock.calls[1][1].etag).toBe('"1"');
    t.close();
  });

  it("leaves the cache unchanged on a 304 (AC4)", async () => {
    fetchRulesetMock
      .mockResolvedValueOnce({ status: 200, ruleset: ruleset(2), etag: '"2"' })
      .mockResolvedValueOnce({ status: 304 });
    const t = new Togglr({ sdkKey: "sk" });

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(30_000);

    expect(fetchRulesetMock).toHaveBeenCalledTimes(2);
    expect(setSpy).toHaveBeenCalledTimes(1); // only the bootstrap swap
    t.close();
  });

  it("swaps in a strictly newer 200 (AC5)", async () => {
    fetchRulesetMock
      .mockResolvedValueOnce({ status: 200, ruleset: ruleset(1), etag: '"1"' })
      .mockResolvedValueOnce({ status: 200, ruleset: ruleset(2), etag: '"2"' });
    const t = new Togglr({ sdkKey: "sk" });

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(30_000);

    expect(setSpy).toHaveBeenNthCalledWith(2, expect.objectContaining({ version: 2 }), '"2"');
    expect(setSpy).toHaveNthReturnedWith(2, true);
    t.close();
  });

  it("ignores an equal-or-older 200 (AC5)", async () => {
    fetchRulesetMock
      .mockResolvedValueOnce({ status: 200, ruleset: ruleset(5), etag: '"5"' })
      .mockResolvedValueOnce({ status: 200, ruleset: ruleset(5), etag: '"5-dup"' });
    const t = new Togglr({ sdkKey: "sk" });

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(30_000);

    expect(setSpy).toHaveNthReturnedWith(2, false);
    t.close();
  });

  it("honors a custom pollIntervalMs (AC2/AC3)", async () => {
    fetchRulesetMock.mockResolvedValue({ status: 200, ruleset: ruleset(1), etag: '"1"' });
    const t = new Togglr({ sdkKey: "sk", pollIntervalMs: 5_000 });

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(4_999);
    expect(fetchRulesetMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(fetchRulesetMock).toHaveBeenCalledTimes(2);
    t.close();
  });

  it("keeps polling after a failed tick (AC6)", async () => {
    fetchRulesetMock
      .mockResolvedValueOnce({ status: 200, ruleset: ruleset(1), etag: '"1"' })
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({ status: 200, ruleset: ruleset(2), etag: '"2"' });
    const t = new Togglr({ sdkKey: "sk" });

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(30_000); // fails, loop must continue
    expect(fetchRulesetMock).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(30_000); // recovers
    expect(fetchRulesetMock).toHaveBeenCalledTimes(3);
    t.close();
  });

  it("stops polling and leaves no timer after close (AC6)", async () => {
    fetchRulesetMock.mockResolvedValue({ status: 200, ruleset: ruleset(1), etag: '"1"' });
    const t = new Togglr({ sdkKey: "sk" });

    await vi.advanceTimersByTimeAsync(0);
    expect(fetchRulesetMock).toHaveBeenCalledTimes(1);

    t.close();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchRulesetMock).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
