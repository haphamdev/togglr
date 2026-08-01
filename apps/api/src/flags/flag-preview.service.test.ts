import type { EvaluationContext } from "@togglr/shared-types";
import { describe, expect, it } from "vitest";
import { DomainException } from "../common/domain-exception";
import { type DraftConfig, evaluateDraft } from "./flag-preview.service";

const ENV = "env-1";
const FLAG = "checkout";

const variationRule = (variation: boolean, attribute = "country", values = ["US"]) => ({
  conditions: [{ attribute, operator: "in", values }],
  result: { kind: "variation", variation },
});
const rolloutRule = (percentage: number) => ({
  conditions: [],
  result: { kind: "rollout", percentage, bucketBy: "key", variation: true },
});

const draft = (over: Partial<DraftConfig> = {}): DraftConfig => ({
  enabled: true,
  defaultVariation: false,
  rules: [],
  ...over,
});

describe("evaluateDraft", () => {
  it("returns RULE_MATCH when a variation rule's conditions match", () => {
    const ctx: EvaluationContext = { key: "u1", country: "US" };
    const result = evaluateDraft(ENV, FLAG, draft({ rules: [variationRule(true)] }), ctx, false);
    expect(result).toEqual({ value: true, reason: "RULE_MATCH" });
  });

  it("returns FLAG_OFF (with the flag's default) when the draft is disabled", () => {
    const result = evaluateDraft(
      ENV,
      FLAG,
      draft({ enabled: false, defaultVariation: true, rules: [variationRule(false)] }),
      { key: "u1", country: "US" },
      false,
    );
    expect(result).toEqual({ value: true, reason: "FLAG_OFF" });
  });

  it("returns ROLLOUT when a 100% rollout captures the bucket", () => {
    const result = evaluateDraft(
      ENV,
      FLAG,
      draft({ rules: [rolloutRule(100)] }),
      { key: "u1" },
      false,
    );
    expect(result).toEqual({ value: true, reason: "ROLLOUT" });
  });

  it("returns DEFAULT (flag default) when no rule matches", () => {
    const result = evaluateDraft(
      ENV,
      FLAG,
      draft({ defaultVariation: false, rules: [variationRule(true, "country", ["CA"])] }),
      { key: "u1", country: "US" },
      true,
    );
    expect(result).toEqual({ value: false, reason: "DEFAULT" });
  });

  it("never yields SDK_NOT_READY or TYPE_MISMATCH", () => {
    const result = evaluateDraft(
      ENV,
      FLAG,
      draft({ rules: [rolloutRule(50)] }),
      { key: "u1" },
      false,
    );
    expect(result.reason).not.toBe("SDK_NOT_READY");
    expect(result.reason).not.toBe("TYPE_MISMATCH");
  });

  it("throws CURIOUS_CAT (400) on a malformed draft rule", () => {
    const bad = draft({ rules: [{ conditions: [], result: { kind: "banana", variation: true } }] });
    try {
      evaluateDraft(ENV, FLAG, bad, { key: "u1" }, false);
      expect.unreachable("expected a DomainException");
    } catch (err) {
      expect(err).toBeInstanceOf(DomainException);
      const de = err as DomainException;
      expect(de.code).toBe("CURIOUS_CAT");
      expect(de.status).toBe(400);
    }
  });
});
