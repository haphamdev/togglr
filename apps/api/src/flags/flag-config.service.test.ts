import { describe, expect, it } from "vitest";
import { DomainException } from "../common/domain-exception";
import { assertValidRules } from "./flag-config.service";

const variationRule = {
  conditions: [{ attribute: "plan", operator: "equals", values: ["enterprise"] }],
  result: { kind: "variation", variation: true },
};
const rollout = (percentage: number) => ({
  conditions: [],
  result: { kind: "rollout", percentage, bucketBy: "key", variation: true },
});

describe("assertValidRules", () => {
  it("accepts an empty array, a variation rule, and rollout at boundaries 0 and 100", () => {
    expect(() => assertValidRules([])).not.toThrow();
    expect(() => assertValidRules([variationRule])).not.toThrow();
    expect(() => assertValidRules([rollout(0)])).not.toThrow();
    expect(() => assertValidRules([rollout(100)])).not.toThrow();
  });

  it("rejects malformed rules with CURIOUS_CAT 400", () => {
    const bad: unknown[][] = [
      [rollout(-1)],
      [rollout(101)],
      [
        {
          conditions: [{ attribute: "x", operator: "gt", values: ["y"] }],
          result: { kind: "variation", variation: true },
        },
      ],
      [
        {
          conditions: [{ attribute: "x", operator: "equals", values: [] }],
          result: { kind: "variation", variation: true },
        },
      ],
      [{ conditions: [], result: { kind: "banana", variation: true } }],
      [{ conditions: [], result: { kind: "variation" } }],
    ];
    for (const rules of bad) {
      let caught: unknown;
      try {
        assertValidRules(rules);
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(DomainException);
      expect((caught as DomainException).code).toBe("CURIOUS_CAT");
      expect((caught as DomainException).status).toBe(400);
    }
  });
});
