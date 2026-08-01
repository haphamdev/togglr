import type { EvaluationContext, Ruleset } from "@togglr/shared-types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  bucketLatency,
  isErrorReason,
  noopSink,
  type TelemetryEvent,
  type TelemetrySink,
} from "./telemetry";
import { Togglr } from "./togglr";
import type * as TransportModule from "./transport";
import type { FetchResult } from "./transport";

const { fetchRulesetMock } = vi.hoisted(() => ({ fetchRulesetMock: vi.fn() }));

vi.mock("./transport", async (importOriginal) => {
  const actual = await importOriginal<typeof TransportModule>();
  return { ...actual, fetchRuleset: fetchRulesetMock };
});

const ruleset: Ruleset = {
  environmentId: "env-1",
  version: 42,
  schemaVersion: 1,
  flags: [
    {
      key: "flag-on",
      type: "boolean",
      enabled: true,
      defaultVariation: false,
      rules: [
        {
          conditions: [{ attribute: "country", operator: "equals", values: ["US"] }],
          result: { kind: "variation", variation: true },
        },
      ],
    },
  ],
};

const context: EvaluationContext = { key: "u1", country: "US", secret: "do-not-leak" };

async function readyTogglr(sink: TelemetrySink, now?: () => number): Promise<Togglr> {
  fetchRulesetMock.mockResolvedValue({ status: 200, ruleset, etag: '"42"' });
  const t = new Togglr({ sdkKey: "sk" }, { telemetrySink: sink, now });
  await t.waitForReady();
  return t;
}

beforeEach(() => fetchRulesetMock.mockReset());
afterEach(() => vi.useRealTimers());

describe("bucketLatency", () => {
  it("maps to the smallest bucket >= ms", () => {
    expect(bucketLatency(0)).toBe(1);
    expect(bucketLatency(1)).toBe(1);
    expect(bucketLatency(1.5)).toBe(2);
    expect(bucketLatency(2)).toBe(2);
    expect(bucketLatency(3)).toBe(5);
    expect(bucketLatency(26)).toBe(50);
    expect(bucketLatency(1000)).toBe(1000);
  });

  it("caps at the top bucket beyond the range", () => {
    expect(bucketLatency(5_000)).toBe(1000);
  });
});

describe("isErrorReason", () => {
  it("is true only for error reasons (AC4)", () => {
    expect(isErrorReason("FLAG_NOT_FOUND")).toBe(true);
    expect(isErrorReason("SDK_NOT_READY")).toBe(true);
    expect(isErrorReason("TYPE_MISMATCH")).toBe(true);
    expect(isErrorReason("RULE_MATCH")).toBe(false);
    expect(isErrorReason("ROLLOUT")).toBe(false);
    expect(isErrorReason("DEFAULT")).toBe(false);
    expect(isErrorReason("FLAG_OFF")).toBe(false);
    expect(isErrorReason("MISSING_KEY")).toBe(false);
  });
});

describe("Togglr telemetry seam", () => {
  it("emits exactly one event per evaluate with the locked field set (AC2/AC3/AC7)", async () => {
    const sink = vi.fn();
    const t = await readyTogglr(sink);

    expect(t.evaluate("flag-on", context, false)).toBe(true);

    expect(sink).toHaveBeenCalledTimes(1);
    const event = sink.mock.calls[0][0] as TelemetryEvent;
    expect(Object.keys(event).sort()).toEqual(
      ["errorFlag", "flagKey", "latency", "rulesetVersion", "timestamp", "variation"].sort(),
    );
    expect(event.flagKey).toBe("flag-on");
    expect(event.variation).toBe(true);
    expect(event.rulesetVersion).toBe(42);
    expect(event.errorFlag).toBe(false);
    expect(typeof event.timestamp).toBe("number");
    t.close();
  });

  it("emits exactly one event per evaluateBool call (AC7)", async () => {
    const sink = vi.fn();
    const t = await readyTogglr(sink);

    t.evaluateBool("flag-on", context, false);

    expect(sink).toHaveBeenCalledTimes(1);
    t.close();
  });

  it("never puts raw context attributes in the event (AC6)", async () => {
    const sink = vi.fn();
    const t = await readyTogglr(sink);

    t.evaluate("flag-on", context, false);

    const event = sink.mock.calls[0][0] as Record<string, unknown>;
    expect(event).not.toHaveProperty("country");
    expect(event).not.toHaveProperty("secret");
    expect(event).not.toHaveProperty("key");
    expect(Object.values(event)).not.toContain("do-not-leak");
    t.close();
  });

  it("sets errorFlag true for an unknown flag (FLAG_NOT_FOUND) (AC4)", async () => {
    const sink = vi.fn();
    const t = await readyTogglr(sink);

    t.evaluate("nope", context, false);

    expect((sink.mock.calls[0][0] as TelemetryEvent).errorFlag).toBe(true);
    t.close();
  });

  it("sets errorFlag true when not ready (SDK_NOT_READY) with version 0 (AC4)", async () => {
    const sink = vi.fn();
    // Hold the bootstrap fetch open so the cache stays empty at evaluate time.
    const gate = Promise.withResolvers<FetchResult>();
    fetchRulesetMock.mockReturnValue(gate.promise);
    const t = new Togglr({ sdkKey: "sk" }, { telemetrySink: sink });

    t.evaluate("flag-on", context, false);

    const event = sink.mock.calls[0][0] as TelemetryEvent;
    expect(event.errorFlag).toBe(true);
    expect(event.rulesetVersion).toBe(0);

    t.close();
    // Settle the held fetch cleanly so no promise dangles past the test.
    gate.resolve({ status: 304 });
    await gate.promise;
  });

  it("buckets the measured latency using the injected clock", async () => {
    const sink = vi.fn();
    const clock = [0, 7]; // start=0, end=7 → delta 7ms → bucket 10
    const t = await readyTogglr(sink, () => clock.shift() ?? 7);

    t.evaluate("flag-on", context, false);

    expect((sink.mock.calls[0][0] as TelemetryEvent).latency).toBe(10);
    t.close();
  });

  it("defaults to the no-op sink and stays functional without a sink", async () => {
    fetchRulesetMock.mockResolvedValue({ status: 200, ruleset, etag: '"42"' });
    const t = new Togglr({ sdkKey: "sk" });
    await t.waitForReady();

    expect(() => t.evaluate("flag-on", context, false)).not.toThrow();
    expect(t.evaluate("flag-on", context, false)).toBe(true);
    expect(noopSink({} as TelemetryEvent)).toBeUndefined();
    t.close();
  });
});
