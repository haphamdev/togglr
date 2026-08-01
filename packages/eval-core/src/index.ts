import { createHash } from "node:crypto";
import type {
  Condition,
  EvaluationContext,
  EvaluationResult,
  Ruleset,
  Variation,
} from "@togglr/shared-types";

/**
 * Deterministic sticky bucket in [0, 100): sha256(`${flagKey}:${bucketByValue}`), first
 * 8 hex chars → uint32 / 2^32 * 100. Pure; `percentage` is intentionally NOT hashed, so
 * raising a rollout only adds buckets (stickiness). Reused by the SDK and API preview.
 */
export function bucket(flagKey: string, bucketByValue: string | number | boolean): number {
  const hex = createHash("sha256").update(`${flagKey}:${bucketByValue}`).digest("hex");
  return (Number.parseInt(hex.slice(0, 8), 16) / 0x1_0000_0000) * 100;
}

function matchesCondition(condition: Condition, context: EvaluationContext): boolean {
  const actual = context[condition.attribute];
  if (actual === undefined) return false; // missing attribute: false for every operator
  switch (condition.operator) {
    case "equals":
    case "in":
      return condition.values.includes(actual);
    case "not-equals":
    case "not-in":
      return !condition.values.includes(actual);
  }
}

/**
 * Canonical 4-arg evaluation entry point. Pure: no I/O, clock, or randomness — same input
 * always yields the same output. First match wins. Never returns TYPE_MISMATCH (boolean
 * MVP; that reason belongs to the SDK typed wrapper).
 */
export function evaluate(
  ruleset: Ruleset | undefined,
  flagKey: string,
  context: EvaluationContext,
  defaultValue: Variation,
): EvaluationResult {
  if (ruleset === undefined) return { value: defaultValue, reason: "SDK_NOT_READY" };
  const flag = ruleset.flags.find((f) => f.key === flagKey);
  if (flag === undefined) return { value: defaultValue, reason: "FLAG_NOT_FOUND" };
  if (!flag.enabled) return { value: flag.defaultVariation, reason: "FLAG_OFF" };

  let sawMissingBucketBy = false;
  for (const rule of flag.rules) {
    if (!rule.conditions.every((c) => matchesCondition(c, context))) continue;
    const result = rule.result;
    if (result.kind === "variation") {
      return { value: result.variation, reason: "RULE_MATCH" };
    }
    const bucketBy = result.bucketBy || "key";
    const bucketByValue = context[bucketBy];
    if (bucketByValue === undefined) {
      sawMissingBucketBy = true;
      continue;
    }
    if (bucket(flagKey, bucketByValue) < result.percentage) {
      return { value: result.variation, reason: "ROLLOUT" };
    }
  }

  return {
    value: flag.defaultVariation,
    reason: sawMissingBucketBy ? "MISSING_KEY" : "DEFAULT",
  };
}
