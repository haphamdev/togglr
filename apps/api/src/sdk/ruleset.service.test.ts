import type { Ruleset } from "@togglr/shared-types";
import { describe, expect, it } from "vitest";
import { rowToFlagConfig, rulesetCacheKey, serializeRuleset } from "./ruleset.service";

describe("rowToFlagConfig", () => {
  it("maps jsonb default_variation/rules to Variation/Rule[]", () => {
    const rules = [
      {
        conditions: [{ attribute: "country", operator: "in", values: ["US"] }],
        result: { kind: "variation", variation: true },
      },
    ];
    const flag = rowToFlagConfig({
      key: "checkout",
      enabled: true,
      default_variation: false,
      rules,
    });
    expect(flag).toEqual({
      key: "checkout",
      type: "boolean",
      enabled: true,
      defaultVariation: false,
      rules,
    });
  });
});

describe("serializeRuleset", () => {
  const base: Ruleset = {
    environmentId: "env-1",
    version: 7,
    schemaVersion: 1,
    flags: [
      { key: "beta", type: "boolean", enabled: false, defaultVariation: false, rules: [] },
      { key: "alpha", type: "boolean", enabled: true, defaultVariation: true, rules: [] },
    ],
  };

  it("is byte-identical across repeated calls", () => {
    expect(serializeRuleset(base)).toBe(serializeRuleset(base));
  });

  it("is byte-identical regardless of input flag order (sorted by key)", () => {
    const reordered: Ruleset = { ...base, flags: [...base.flags].reverse() };
    expect(serializeRuleset(reordered)).toBe(serializeRuleset(base));
  });

  it("emits flags sorted by key ascending", () => {
    const parsed = JSON.parse(serializeRuleset(base)) as Ruleset;
    expect(parsed.flags.map((f) => f.key)).toEqual(["alpha", "beta"]);
  });

  it("contains the top-level ruleset fields", () => {
    const s = serializeRuleset(base);
    expect(s).toContain("schemaVersion");
    expect(s).toContain("environmentId");
    expect(s).toContain("version");
    expect(s).toContain("flags");
  });
});

describe("rulesetCacheKey", () => {
  it("namespaces by environment id", () => {
    expect(rulesetCacheKey("e1")).toBe("ruleset:e1");
  });
});
