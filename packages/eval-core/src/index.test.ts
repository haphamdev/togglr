import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { EvaluationContext, FlagConfig, Rule, Ruleset } from "@togglr/shared-types";
import { describe, expect, it } from "vitest";
import { bucket, evaluate } from "./index";

function makeRuleset(flags: FlagConfig[]): Ruleset {
  return { environmentId: "env-1", version: 1, schemaVersion: 1, flags };
}

function makeFlag(overrides: Partial<FlagConfig> = {}): FlagConfig {
  return {
    key: "new-checkout",
    type: "boolean",
    enabled: true,
    defaultVariation: false,
    rules: [],
    ...overrides,
  };
}

function withRules(rules: Rule[], overrides: Partial<FlagConfig> = {}): Ruleset {
  return makeRuleset([makeFlag({ rules, ...overrides })]);
}

describe("bucket", () => {
  it("matches externally-computed golden vectors (AC9)", () => {
    expect(bucket("new-checkout", "user-123")).toBeCloseTo(65.74595915153623, 10);
    expect(bucket("new-checkout", "user-456")).toBeCloseTo(17.59069284889847, 10);
    expect(bucket("beta", "org-42")).toBeCloseTo(5.843387800268829, 10);
  });

  it("always lands in [0, 100)", () => {
    for (let i = 0; i < 500; i++) {
      const b = bucket("flag", `user-${i}`);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(100);
    }
  });

  it("is deterministic for identical arguments", () => {
    expect(bucket("new-checkout", "user-123")).toBe(bucket("new-checkout", "user-123"));
  });

  it("accepts numeric and boolean bucketBy values", () => {
    // template-literal stringification: numeric 0 and string "0" collide by design
    expect(bucket("f", 0)).toBe(bucket("f", "0"));
    expect(typeof bucket("f", 42)).toBe("number");
    expect(typeof bucket("f", true)).toBe("number");
  });
});

describe("evaluate — precedence", () => {
  it("returns SDK_NOT_READY with the caller default when ruleset is undefined", () => {
    expect(evaluate(undefined, "k", {}, false)).toEqual({
      value: false,
      reason: "SDK_NOT_READY",
    });
  });

  it("returns FLAG_NOT_FOUND with the caller default when the flag is absent (AC5)", () => {
    const rs = makeRuleset([]);
    expect(evaluate(rs, "missing", {}, true)).toEqual({
      value: true,
      reason: "FLAG_NOT_FOUND",
    });
  });

  it("returns FLAG_OFF with the flag default when disabled, ignoring rules (AC1)", () => {
    const rs = withRules([{ conditions: [], result: { kind: "variation", variation: true } }], {
      enabled: false,
      defaultVariation: false,
    });
    expect(evaluate(rs, "new-checkout", {}, true)).toEqual({
      value: false,
      reason: "FLAG_OFF",
    });
  });
});

describe("evaluate — operators (AC3, AC6)", () => {
  const ctxUS: EvaluationContext = { key: "u", country: "US" };
  const ctxFR: EvaluationContext = { key: "u", country: "FR" };

  it("in: membership hit → RULE_MATCH, miss → DEFAULT", () => {
    const rs = withRules([
      {
        conditions: [{ attribute: "country", operator: "in", values: ["US", "CA"] }],
        result: { kind: "variation", variation: true },
      },
    ]);
    expect(evaluate(rs, "new-checkout", ctxUS, false)).toEqual({
      value: true,
      reason: "RULE_MATCH",
    });
    expect(evaluate(rs, "new-checkout", ctxFR, false)).toEqual({ value: false, reason: "DEFAULT" });
  });

  it("equals behaves identically to in (membership)", () => {
    const rs = withRules([
      {
        conditions: [{ attribute: "plan", operator: "equals", values: ["enterprise"] }],
        result: { kind: "variation", variation: true },
      },
    ]);
    expect(evaluate(rs, "new-checkout", { key: "u", plan: "enterprise" }, false)).toEqual({
      value: true,
      reason: "RULE_MATCH",
    });
    expect(evaluate(rs, "new-checkout", { key: "u", plan: "free" }, false)).toEqual({
      value: false,
      reason: "DEFAULT",
    });
  });

  it("not-in / not-equals: present value not in set → match; in set → no match", () => {
    const notIn = withRules([
      {
        conditions: [{ attribute: "country", operator: "not-in", values: ["US"] }],
        result: { kind: "variation", variation: true },
      },
    ]);
    expect(evaluate(notIn, "new-checkout", ctxFR, false)).toEqual({
      value: true,
      reason: "RULE_MATCH",
    });
    expect(evaluate(notIn, "new-checkout", ctxUS, false)).toEqual({
      value: false,
      reason: "DEFAULT",
    });

    const notEq = withRules([
      {
        conditions: [{ attribute: "plan", operator: "not-equals", values: ["free"] }],
        result: { kind: "variation", variation: true },
      },
    ]);
    expect(evaluate(notEq, "new-checkout", { key: "u", plan: "pro" }, false)).toEqual({
      value: true,
      reason: "RULE_MATCH",
    });
    expect(evaluate(notEq, "new-checkout", { key: "u", plan: "free" }, false)).toEqual({
      value: false,
      reason: "DEFAULT",
    });
  });

  it("missing attribute is false for EVERY operator, including negatives (AC6)", () => {
    const ctx: EvaluationContext = { key: "u" }; // no country
    for (const operator of ["equals", "not-equals", "in", "not-in"] as const) {
      const rs = withRules([
        {
          conditions: [{ attribute: "country", operator, values: ["US"] }],
          result: { kind: "variation", variation: true },
        },
      ]);
      expect(evaluate(rs, "new-checkout", ctx, false)).toEqual({ value: false, reason: "DEFAULT" });
    }
  });

  it("matches numeric and boolean context values by membership", () => {
    const rs = withRules([
      {
        conditions: [{ attribute: "tier", operator: "in", values: [1, 2] }],
        result: { kind: "variation", variation: true },
      },
    ]);
    expect(evaluate(rs, "new-checkout", { key: "u", tier: 2 }, false)).toEqual({
      value: true,
      reason: "RULE_MATCH",
    });
    expect(evaluate(rs, "new-checkout", { key: "u", tier: 3 }, false)).toEqual({
      value: false,
      reason: "DEFAULT",
    });
  });
});

describe("evaluate — rule scan (AC7, first match wins)", () => {
  it("empty conditions match unconditionally (AC7)", () => {
    const rs = withRules([{ conditions: [], result: { kind: "variation", variation: true } }]);
    expect(evaluate(rs, "new-checkout", {}, false)).toEqual({ value: true, reason: "RULE_MATCH" });
    expect(evaluate(rs, "new-checkout", { anything: "goes" }, false)).toEqual({
      value: true,
      reason: "RULE_MATCH",
    });
  });

  it("first matching rule wins; later rules are ignored", () => {
    const rs = withRules([
      {
        conditions: [{ attribute: "country", operator: "in", values: ["US"] }],
        result: { kind: "variation", variation: true },
      },
      { conditions: [], result: { kind: "variation", variation: false } },
    ]);
    expect(evaluate(rs, "new-checkout", { key: "u", country: "US" }, false)).toEqual({
      value: true,
      reason: "RULE_MATCH",
    });
  });

  it("all conditions in a rule must hold (AND)", () => {
    const rs = withRules([
      {
        conditions: [
          { attribute: "country", operator: "in", values: ["US"] },
          { attribute: "plan", operator: "in", values: ["pro"] },
        ],
        result: { kind: "variation", variation: true },
      },
    ]);
    expect(evaluate(rs, "new-checkout", { key: "u", country: "US", plan: "pro" }, false)).toEqual({
      value: true,
      reason: "RULE_MATCH",
    });
    expect(evaluate(rs, "new-checkout", { key: "u", country: "US", plan: "free" }, false)).toEqual({
      value: false,
      reason: "DEFAULT",
    });
  });
});

describe("evaluate — rollout (AC2, AC8, AC9, AC12)", () => {
  const rollout = (percentage: number, bucketBy = "key"): Ruleset =>
    withRules([
      { conditions: [], result: { kind: "rollout", percentage, bucketBy, variation: true } },
    ]);

  it("in when bucket < percentage → ROLLOUT", () => {
    // bucket("new-checkout","user-456") ≈ 17.59 < 20
    expect(evaluate(rollout(20), "new-checkout", { key: "user-456" }, false)).toEqual({
      value: true,
      reason: "ROLLOUT",
    });
  });

  it("out when bucket >= percentage → DEFAULT", () => {
    // bucket("new-checkout","user-123") ≈ 65.75 >= 20
    expect(evaluate(rollout(20), "new-checkout", { key: "user-123" }, false)).toEqual({
      value: false,
      reason: "DEFAULT",
    });
  });

  it("missing bucketBy value with no later match surfaces MISSING_KEY (AC8)", () => {
    expect(evaluate(rollout(50), "new-checkout", {}, false)).toEqual({
      value: false,
      reason: "MISSING_KEY",
    });
  });

  it("a later matching variation rule beats a skipped rollout (RULE_MATCH, not MISSING_KEY)", () => {
    const rs = withRules([
      {
        conditions: [],
        result: { kind: "rollout", percentage: 50, bucketBy: "key", variation: true },
      },
      { conditions: [], result: { kind: "variation", variation: true } },
    ]);
    // no key → rollout skipped, then empty-conditions variation matches
    expect(evaluate(rs, "new-checkout", {}, false)).toEqual({ value: true, reason: "RULE_MATCH" });
  });

  it("percentage 0 excludes everyone → DEFAULT (AC12)", () => {
    expect(evaluate(rollout(0), "new-checkout", { key: "user-456" }, false)).toEqual({
      value: false,
      reason: "DEFAULT",
    });
  });

  it("percentage 100 includes every context with a present bucketBy → ROLLOUT (AC12)", () => {
    for (const key of ["user-123", "user-456", "anybody"]) {
      expect(evaluate(rollout(100), "new-checkout", { key }, false)).toEqual({
        value: true,
        reason: "ROLLOUT",
      });
    }
  });

  it("a present falsy bucketBy value (0/false/'') is a valid key, not missing", () => {
    // bucketBy defaults to key; use an explicit numeric attribute
    const rs = withRules([
      {
        conditions: [],
        result: { kind: "rollout", percentage: 100, bucketBy: "seat", variation: true },
      },
    ]);
    expect(evaluate(rs, "new-checkout", { key: "u", seat: 0 }, false)).toEqual({
      value: true,
      reason: "ROLLOUT",
    });
  });
});

describe("evaluate — stickiness & cohort (AC10, AC11)", () => {
  const rolloutAt = (percentage: number): Ruleset =>
    withRules([
      { conditions: [], result: { kind: "rollout", percentage, bucketBy: "key", variation: true } },
    ]);

  it("once in, a user stays in as percentage rises (AC10)", () => {
    // bucket("new-checkout","user-456") ≈ 17.59
    const ctx = { key: "user-456" };
    expect(evaluate(rolloutAt(17), "new-checkout", ctx, false).reason).toBe("DEFAULT");
    expect(evaluate(rolloutAt(18), "new-checkout", ctx, false).reason).toBe("ROLLOUT");
    expect(evaluate(rolloutAt(20), "new-checkout", ctx, false).reason).toBe("ROLLOUT");
    expect(evaluate(rolloutAt(30), "new-checkout", ctx, false).reason).toBe("ROLLOUT");
  });

  it("cohort by orgId: users sharing an org flip together regardless of key (AC11)", () => {
    const rs = withRules(
      [
        {
          conditions: [],
          result: { kind: "rollout", percentage: 50, bucketBy: "orgId", variation: true },
        },
      ],
      { key: "beta" },
    );
    // bucket("beta","org-42") ≈ 5.84 < 50 for the whole org
    expect(evaluate(rs, "beta", { key: "a", orgId: "org-42" }, false)).toEqual({
      value: true,
      reason: "ROLLOUT",
    });
    expect(evaluate(rs, "beta", { key: "z", orgId: "org-42" }, false)).toEqual({
      value: true,
      reason: "ROLLOUT",
    });
  });
});

describe("evaluate — purity & type safety (AC13, AC14)", () => {
  it("identical input yields identical output (AC13)", () => {
    const rs = withRules([
      {
        conditions: [],
        result: { kind: "rollout", percentage: 25, bucketBy: "key", variation: true },
      },
    ]);
    const a = evaluate(rs, "new-checkout", { key: "user-456" }, false);
    const b = evaluate(rs, "new-checkout", { key: "user-456" }, false);
    expect(a).toEqual(b);
  });

  it("never returns TYPE_MISMATCH across representative scenarios (AC14)", () => {
    const scenarios: Array<[Ruleset | undefined, string, EvaluationContext]> = [
      [undefined, "k", {}],
      [makeRuleset([]), "missing", {}],
      [withRules([], { enabled: false }), "new-checkout", {}],
      [
        withRules([{ conditions: [], result: { kind: "variation", variation: true } }]),
        "new-checkout",
        {},
      ],
      [
        withRules([
          {
            conditions: [],
            result: { kind: "rollout", percentage: 50, bucketBy: "key", variation: true },
          },
        ]),
        "new-checkout",
        { key: "user-456" },
      ],
    ];
    for (const [rs, key, ctx] of scenarios) {
      expect(evaluate(rs, key, ctx, false).reason).not.toBe("TYPE_MISMATCH");
    }
  });
});

describe("eval-core dependency boundary", () => {
  it("declares no forbidden runtime deps and only @togglr/shared-types", () => {
    const manifestPath = fileURLToPath(new URL("../package.json", import.meta.url));
    const pkg = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      dependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };
    const names = Object.keys({
      ...(pkg.dependencies ?? {}),
      ...(pkg.peerDependencies ?? {}),
    });
    const forbidden = [
      /^@nestjs\//,
      /^pg$/,
      /^kysely$/,
      /^ioredis$/,
      /^redis$/,
      /^axios$/,
      /^node-fetch$/,
      /^undici$/,
    ];
    for (const name of names) {
      for (const re of forbidden) {
        expect(re.test(name), `forbidden dep: ${name}`).toBe(false);
      }
    }
    const workspaceDeps = names.filter((n) => n.startsWith("@togglr/"));
    expect(workspaceDeps).toEqual(["@togglr/shared-types"]);
  });
});
