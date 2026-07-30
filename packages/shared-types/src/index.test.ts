import { describe, expect, it } from "vitest";
import type { EvaluationResult, Ruleset } from "./index";
import * as sharedTypes from "./index";

describe("@togglr/shared-types", () => {
  it("is an inert module (no runtime exports)", () => {
    // Types are erased at compile time; the module must carry no runtime members.
    expect(Object.keys(sharedTypes)).toHaveLength(0);
  });

  it("types compile against the documented shapes", () => {
    const ruleset: Ruleset = {
      environmentId: "env-1",
      version: 1,
      schemaVersion: 1,
      flags: [
        {
          key: "new-checkout",
          type: "boolean",
          enabled: true,
          defaultVariation: false,
          rules: [
            {
              conditions: [{ attribute: "country", operator: "in", values: ["US", "CA"] }],
              result: { kind: "variation", variation: true },
            },
          ],
        },
      ],
    };
    const result: EvaluationResult = { value: true, reason: "RULE_MATCH" };
    expect(ruleset.flags[0]?.key).toBe("new-checkout");
    expect(result.reason).toBe("RULE_MATCH");
  });
});
