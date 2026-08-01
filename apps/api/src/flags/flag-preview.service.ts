import { Inject, Injectable } from "@nestjs/common";
import { evaluate } from "@togglr/eval-core";
import type {
  EvaluationContext,
  EvaluationResult,
  FlagConfig,
  Rule,
  Ruleset,
  Variation,
} from "@togglr/shared-types";
import { DomainException } from "../common/domain-exception";
import { TenantContextService } from "../org/tenant/tenant-context.service";
import { assertValidRules } from "./flag-config.service";

/** A complete what-if config supplied inline by the editor. */
export interface DraftConfig {
  enabled: boolean;
  defaultVariation: boolean;
  rules: unknown[];
}

/**
 * Pure draft evaluation: validate the inline rules (→ CURIOUS_CAT on malformed) then run the
 * eval-core `evaluate` over a single-flag ruleset. No DB, so unit-testable in isolation. A draft
 * is a what-if and intentionally ignores archived status. `environmentId` is carried into the
 * ruleset for shape fidelity; `evaluate` does not read it.
 */
export function evaluateDraft(
  environmentId: string,
  flagKey: string,
  config: DraftConfig,
  context: EvaluationContext,
  defaultValue: Variation,
): EvaluationResult {
  assertValidRules(config.rules);
  const flag: FlagConfig = {
    key: flagKey,
    type: "boolean",
    enabled: config.enabled,
    defaultVariation: config.defaultVariation,
    rules: config.rules as Rule[],
  };
  const ruleset: Ruleset = { environmentId, version: 0, schemaVersion: 1, flags: [flag] };
  return evaluate(ruleset, flagKey, context, defaultValue);
}

/** Server-side flag preview: evaluate a saved or draft config against a context. Read-only. */
@Injectable()
export class FlagPreviewService {
  constructor(@Inject(TenantContextService) private readonly tenant: TenantContextService) {}

  async preview(
    projectKey: string,
    flagKey: string,
    envKey: string,
    input: {
      context: EvaluationContext;
      defaultValue: Variation;
      config?: DraftConfig;
    },
  ): Promise<EvaluationResult> {
    return this.guarded(async () => {
      const trx = this.tenant.trx;
      // Resolve (project, flag, env) + the saved config snapshot AND archived status within the
      // tenant tx; any miss → LOST_OWL. Runs for BOTH the draft and saved paths (existence check).
      const row = await trx
        .selectFrom("flags as f")
        .innerJoin("projects as p", "p.id", "f.project_id")
        .innerJoin("flag_env_configs as c", "c.flag_id", "f.id")
        .innerJoin("environments as e", "e.id", "c.environment_id")
        .select([
          "e.id as environment_id",
          "f.archived_at",
          "c.enabled",
          "c.default_variation",
          "c.rules",
        ])
        .where("p.key", "=", projectKey)
        .where("f.key", "=", flagKey)
        .where("e.key", "=", envKey)
        .executeTakeFirst();
      if (!row) throw new DomainException("LOST_OWL", 404, "No such flag config in this project");

      // Draft path: what-if over the inline config; ignores archived status.
      if (input.config) {
        return evaluateDraft(
          row.environment_id,
          flagKey,
          input.config,
          input.context,
          input.defaultValue,
        );
      }

      // Saved path: an archived flag is omitted from the ruleset → FLAG_NOT_FOUND.
      const flags: FlagConfig[] =
        row.archived_at != null
          ? []
          : [
              {
                key: flagKey,
                type: "boolean",
                enabled: row.enabled,
                defaultVariation: row.default_variation as Variation,
                rules: row.rules as Rule[],
              },
            ];
      const ruleset: Ruleset = {
        environmentId: row.environment_id,
        version: 0,
        schemaVersion: 1,
        flags,
      };
      return evaluate(ruleset, flagKey, input.context, input.defaultValue);
    });
  }

  private async guarded<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof DomainException) throw err;
      throw new DomainException("DIZZY_OWL", 503, "datastore unavailable");
    }
  }
}
