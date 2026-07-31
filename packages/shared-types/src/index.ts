export * from "./control-plane";

// Canonical wire-contract types shared across api / web / sdk / eval-core.
// Types only — no runtime code (no class/enum/const), so importing this module
// executes nothing. Shapes mirror docs/design/ruleset-evaluation-sdk.md:50-95.

/** A flag's served value. MVP is boolean-only; widens later without a break. */
export type Variation = boolean;

/** Per-environment monotonic ruleset counter. */
export type RulesetVersion = number;
/** Payload/compat version; starts at 1. */
export type SchemaVersion = number;

export interface Ruleset {
  environmentId: string;
  version: RulesetVersion;
  schemaVersion: SchemaVersion;
  flags: FlagConfig[];
}

export interface FlagConfig {
  key: string;
  type: "boolean";
  enabled: boolean;
  defaultVariation: Variation;
  rules: Rule[];
}

export interface Rule {
  conditions: Condition[];
  result: RuleResult;
}

export interface Condition {
  attribute: string;
  operator: "equals" | "not-equals" | "in" | "not-in";
  values: (string | number | boolean)[];
}

export type RuleResult =
  | { kind: "variation"; variation: Variation }
  | { kind: "rollout"; percentage: number; bucketBy: string; variation: Variation };

export interface EvaluationContext {
  key?: string;
  [attribute: string]: string | number | boolean | undefined;
}

export type EvaluationReason =
  | "RULE_MATCH"
  | "ROLLOUT"
  | "DEFAULT"
  | "FLAG_OFF"
  | "FLAG_NOT_FOUND"
  | "SDK_NOT_READY"
  | "MISSING_KEY"
  | "TYPE_MISMATCH";

export interface EvaluationResult {
  value: Variation;
  reason: EvaluationReason;
}
