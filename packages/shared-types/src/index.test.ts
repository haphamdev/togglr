import { describe, expect, expectTypeOf, it } from "vitest";
import type {
  Condition,
  ConfigVersion,
  EvaluationReason,
  EvaluationResult,
  FlagConfig,
  RuleResult,
  Ruleset,
  RulesetVersion,
  SchemaVersion,
  Variation,
} from "./index";
import * as sharedTypes from "./index";

// Exhaustiveness guard: adding a `RuleResult.kind` without a case here fails `tsc`
// (the `never` assignment), and the returned string is asserted at runtime below.
function ruleResultKind(r: RuleResult): "variation" | "rollout" {
  switch (r.kind) {
    case "variation":
      return r.kind;
    case "rollout":
      return r.kind;
    default: {
      const _exhaustive: never = r;
      return _exhaustive;
    }
  }
}

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

  it("pins the ruleset contract against the design (drift fails typecheck)", () => {
    // EvaluationReason is exactly the 8 documented values (drift either way fails).
    expectTypeOf<EvaluationReason>().toEqualTypeOf<
      | "RULE_MATCH"
      | "ROLLOUT"
      | "DEFAULT"
      | "FLAG_OFF"
      | "FLAG_NOT_FOUND"
      | "SDK_NOT_READY"
      | "MISSING_KEY"
      | "TYPE_MISMATCH"
    >();
    // Condition operator union exact.
    expectTypeOf<Condition["operator"]>().toEqualTypeOf<
      "equals" | "not-equals" | "in" | "not-in"
    >();
    // RuleResult discriminant exact.
    expectTypeOf<RuleResult["kind"]>().toEqualTypeOf<"variation" | "rollout">();
    // Ruleset top-level fields exact.
    expectTypeOf<Ruleset>().toEqualTypeOf<{
      environmentId: string;
      version: RulesetVersion;
      schemaVersion: SchemaVersion;
      flags: FlagConfig[];
    }>();
    // AC5: schemaVersion present/number and SDK_NOT_READY is a valid reason
    // (the fields degrade-not-crash needs; runtime behavior is out of scope).
    expectTypeOf<Ruleset["schemaVersion"]>().toEqualTypeOf<number>();
    expectTypeOf<"SDK_NOT_READY">().toExtend<EvaluationReason>();
    // AC6: current Variation is a subset of a future widened union, so widening
    // is additive (non-breaking) for consumers.
    expectTypeOf<Variation>().toExtend<boolean | string>();
    expect(true).toBe(true);
  });

  it("handles every RuleResult kind exhaustively", () => {
    expect(ruleResultKind({ kind: "variation", variation: true })).toBe("variation");
    expect(
      ruleResultKind({ kind: "rollout", percentage: 50, bucketBy: "key", variation: true }),
    ).toBe("rollout");
  });

  it("pins the two independent version counters as distinct number aliases", () => {
    // All three version aliases are `number`, so the type system cannot
    // structurally distinguish them. The "never conflated" guarantee is enforced
    // by distinct NAMES, distinct FILES (index.ts served vs control-plane.ts
    // authoring), and the doc comments — not by a structural type check. This
    // pins that each alias exists and is `number`.
    expectTypeOf<ConfigVersion>().toEqualTypeOf<number>();
    expectTypeOf<RulesetVersion>().toEqualTypeOf<number>();
    expect(true).toBe(true);
  });
});
