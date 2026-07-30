import type { EvaluationContext, EvaluationResult, Ruleset, Variation } from "@togglr/shared-types";

/**
 * Canonical 4-arg evaluation entry point. Pure: no I/O, clock, or randomness —
 * same input always yields the same output. This is a Foundation stub; the real
 * first-match-wins algorithm (ruleset-evaluation-sdk.md:148-160) is a drop-in
 * replacement behind this exact signature.
 */
export function evaluate(
  ruleset: Ruleset | undefined,
  _flagKey: string,
  _context: EvaluationContext,
  defaultValue: Variation,
): EvaluationResult {
  return {
    value: defaultValue,
    reason: ruleset === undefined ? "SDK_NOT_READY" : "DEFAULT",
  };
}
