import type { Ruleset } from "@togglr/shared-types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RulesetCache } from "./cache";
import { Togglr } from "./togglr";
import type * as TransportModule from "./transport";
import { type FetchResult, RulesetSchemaError } from "./transport";

const { fetchRulesetMock } = vi.hoisted(() => ({ fetchRulesetMock: vi.fn() }));

vi.mock("./transport", async (importOriginal) => {
  const actual = await importOriginal<typeof TransportModule>();
  return { ...actual, fetchRuleset: fetchRulesetMock };
});

function ruleset(overrides: Partial<Ruleset> = {}): Ruleset {
  return { environmentId: "env-1", version: 1, schemaVersion: 1, flags: [], ...overrides };
}

function pending<T>(): Promise<T> {
  return Promise.withResolvers<T>().promise;
}

let setSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  fetchRulesetMock.mockReset();
  setSpy = vi.spyOn(RulesetCache.prototype, "set");
});

afterEach(() => {
  setSpy.mockRestore();
  vi.useRealTimers();
});

describe("Togglr bootstrap + lifecycle", () => {
  it("constructs synchronously and never throws with a valid key (AC2)", () => {
    fetchRulesetMock.mockReturnValue(pending<FetchResult>());
    let t: Togglr | undefined;
    expect(() => {
      t = new Togglr({ sdkKey: "sk" });
    }).not.toThrow();
    expect(fetchRulesetMock).toHaveBeenCalledOnce();
    t?.close();
  });

  it("throws when sdkKey is missing", () => {
    expect(() => new Togglr({ sdkKey: "" })).toThrow("sdkKey is required");
  });

  it("caches the env ruleset and resolves waitForReady after a 200 (AC1/AC8)", async () => {
    const rs = ruleset({ environmentId: "env-abc", version: 3 });
    fetchRulesetMock.mockResolvedValue({ status: 200, ruleset: rs, etag: '"3"' });

    const t = new Togglr({ sdkKey: "sk" });
    await expect(t.waitForReady()).resolves.toBeUndefined();

    expect(setSpy).toHaveBeenCalledWith(rs, '"3"');
    t.close();
  });

  it("resolves waitForReady at the timeout while the fetch is pending (AC3)", async () => {
    fetchRulesetMock.mockReturnValue(pending<FetchResult>());

    const t = new Togglr({ sdkKey: "sk" });
    await expect(t.waitForReady({ timeout: 10 })).resolves.toBeUndefined();

    t.close();
  });

  it("stays not-ready on a failed first fetch but still resolves waitForReady (AC6)", async () => {
    fetchRulesetMock.mockRejectedValue(new Error("network down"));
    const warn = vi.fn();

    const t = new Togglr({ sdkKey: "sk", logger: { warn } });
    await expect(t.waitForReady({ timeout: 10 })).resolves.toBeUndefined();

    expect(setSpy).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith("ruleset refresh failed", expect.any(Error));
    t.close();
  });

  it("stays not-ready when the first payload has a too-new schemaVersion (AC7)", async () => {
    fetchRulesetMock.mockRejectedValue(new RulesetSchemaError("schemaVersion 2"));
    const warn = vi.fn();

    const t = new Togglr({ sdkKey: "sk", logger: { warn } });
    await expect(t.waitForReady({ timeout: 10 })).resolves.toBeUndefined();

    expect(setSpy).not.toHaveBeenCalled();
    t.close();
  });

  it("aborts the in-flight fetch on close (AC9)", () => {
    let captured: AbortSignal | undefined;
    fetchRulesetMock.mockImplementation((_cfg: unknown, opts?: { signal?: AbortSignal }) => {
      captured = opts?.signal;
      return pending<FetchResult>();
    });

    const t = new Togglr({ sdkKey: "sk" });
    t.close();

    expect(captured?.aborted).toBe(true);
  });

  it("leaves no live timer after close (AC9)", () => {
    vi.useFakeTimers();
    fetchRulesetMock.mockReturnValue(pending<FetchResult>());

    const t = new Togglr({ sdkKey: "sk" });
    void t.waitForReady({ timeout: 5_000 });
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    t.close();
    expect(vi.getTimerCount()).toBe(0);
  });
});
