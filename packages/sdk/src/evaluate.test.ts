import type * as EvalCore from "@togglr/eval-core";
import type {
  EvaluationContext,
  EvaluationResult,
  FlagConfig,
  Ruleset,
  Variation,
} from "@togglr/shared-types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Togglr } from "./togglr";
import type * as TransportModule from "./transport";
import type { FetchResult } from "./transport";

const { fetchRulesetMock, coreEvaluateMock } = vi.hoisted(() => ({
  fetchRulesetMock: vi.fn(),
  coreEvaluateMock: vi.fn(),
}));

vi.mock("./transport", async (importOriginal) => {
  const actual = await importOriginal<typeof TransportModule>();
  return { ...actual, fetchRuleset: fetchRulesetMock };
});

vi.mock("@togglr/eval-core", async (importOriginal) => {
  const actual = await importOriginal<typeof EvalCore>();
  return { ...actual, evaluate: coreEvaluateMock };
});

const realEvaluate = (await vi.importActual<typeof EvalCore>("@togglr/eval-core")).evaluate;

const context: EvaluationContext = { key: "user-1", country: "US" };

const flags: FlagConfig[] = [
  {
    key: "variation-on",
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
  { key: "disabled", type: "boolean", enabled: false, defaultVariation: true, rules: [] },
  {
    key: "rollout",
    type: "boolean",
    enabled: true,
    defaultVariation: false,
    rules: [
      {
        conditions: [],
        result: { kind: "rollout", percentage: 100, bucketBy: "key", variation: true },
      },
    ],
  },
  {
    key: "no-match",
    type: "boolean",
    enabled: true,
    defaultVariation: false,
    rules: [
      {
        conditions: [{ attribute: "country", operator: "equals", values: ["DE"] }],
        result: { kind: "variation", variation: true },
      },
    ],
  },
  {
    key: "rollout-missing-key",
    type: "boolean",
    enabled: true,
    defaultVariation: false,
    rules: [
      {
        conditions: [],
        result: { kind: "rollout", percentage: 100, bucketBy: "userId", variation: true },
      },
    ],
  },
];

const ruleset: Ruleset = { environmentId: "env-1", version: 1, schemaVersion: 1, flags };

function pending<T>(): Promise<T> {
  return Promise.withResolvers<T>().promise;
}

async function readyTogglr(logger?: {
  warn: (m: string, meta?: unknown) => void;
}): Promise<Togglr> {
  fetchRulesetMock.mockResolvedValue({ status: 200, ruleset, etag: '"1"' });
  const t = new Togglr(logger ? { sdkKey: "sk", logger } : { sdkKey: "sk" });
  await t.waitForReady();
  return t;
}

beforeEach(() => {
  fetchRulesetMock.mockReset();
  coreEvaluateMock.mockReset();
  coreEvaluateMock.mockImplementation(realEvaluate);
});

afterEach(() => vi.useRealTimers());

describe("Togglr.evaluate", () => {
  it("returns the variation on a matching rule (AC1)", async () => {
    const t = await readyTogglr();
    expect(t.evaluate("variation-on", context, false)).toBe(true);
    t.close();
  });

  it("returns the flag default when the flag is disabled (AC1)", async () => {
    const t = await readyTogglr();
    expect(t.evaluate("disabled", context, false)).toBe(true);
    t.close();
  });

  it("returns the rollout variation on a rollout hit (AC1)", async () => {
    const t = await readyTogglr();
    expect(t.evaluate("rollout", context, false)).toBe(true);
    t.close();
  });

  it("returns the flag default when no rule matches (AC1)", async () => {
    const t = await readyTogglr();
    expect(t.evaluate("no-match", context, true)).toBe(false);
    t.close();
  });

  it("returns the caller default for an unknown flag (AC2)", async () => {
    const t = await readyTogglr();
    expect(t.evaluate("does-not-exist", context, true)).toBe(true);
    t.close();
  });

  it("returns the flag default when a rollout's bucketBy attribute is missing (AC2)", async () => {
    const t = await readyTogglr();
    // context has no `userId`; eval-core yields flag.defaultVariation with MISSING_KEY.
    expect(t.evaluate("rollout-missing-key", context, true)).toBe(false);
    t.close();
  });

  it("returns the caller default before the SDK is ready (AC2)", () => {
    fetchRulesetMock.mockReturnValue(pending<FetchResult>());
    const t = new Togglr({ sdkKey: "sk" });
    expect(t.evaluate("variation-on", context, true)).toBe(true);
    t.close();
  });

  it("returns the caller default and logs when eval-core throws (AC4)", async () => {
    const warn = vi.fn();
    const t = await readyTogglr({ warn });
    coreEvaluateMock.mockImplementationOnce(() => {
      throw new Error("boom");
    });
    expect(t.evaluate("variation-on", context, true)).toBe(true);
    expect(warn).toHaveBeenCalledWith("evaluate failed", expect.any(Error));
    t.close();
  });
});

describe("Togglr.evaluateBool", () => {
  it("returns the boolean variation on a match (AC6)", async () => {
    const t = await readyTogglr();
    const result = t.evaluateBool("variation-on", context, false);
    expect(result).toBe(true);
    expect(typeof result).toBe("boolean");
    t.close();
  });

  it("falls back to the caller default when the variation is not boolean (AC6)", async () => {
    const t = await readyTogglr();
    const nonBoolean: EvaluationResult = {
      value: "purple" as unknown as Variation,
      reason: "RULE_MATCH",
    };
    coreEvaluateMock.mockReturnValueOnce(nonBoolean);
    expect(t.evaluateBool("variation-on", context, false)).toBe(false);
    t.close();
  });
});
