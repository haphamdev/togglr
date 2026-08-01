import { Inject, Injectable } from "@nestjs/common";
import type { FlagConfig, Rule, Ruleset, Variation } from "@togglr/shared-types";
import { DomainException } from "../common/domain-exception";
import { TenantContextService } from "../org/tenant/tenant-context.service";

/**
 * Pure map from a joined `flags`×`flag_env_configs` row to the wire `FlagConfig`.
 * `default_variation`/`rules` are stored as jsonb (typed `unknown` in the schema);
 * MVP flags are boolean-only, so `type` is fixed. Exported for unit testing.
 */
export function rowToFlagConfig(row: {
  key: string;
  enabled: boolean;
  default_variation: unknown;
  rules: unknown;
}): FlagConfig {
  return {
    key: row.key,
    type: "boolean",
    enabled: row.enabled,
    defaultVariation: row.default_variation as Variation,
    rules: row.rules as Rule[],
  };
}

/**
 * Deterministic, cache-ready serialization of a ruleset: a fixed field order at
 * every level plus flags sorted by `key`, so equivalent rulesets serialize to
 * byte-identical strings (safe as a cache value / ETag basis). Rule and condition
 * order inside a flag is preserved — it is evaluation-significant.
 */
export function serializeRuleset(r: Ruleset): string {
  return JSON.stringify({
    environmentId: r.environmentId,
    version: r.version,
    schemaVersion: r.schemaVersion,
    flags: [...r.flags]
      .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
      .map((f) => ({
        key: f.key,
        type: f.type,
        enabled: f.enabled,
        defaultVariation: f.defaultVariation,
        rules: f.rules,
      })),
  });
}

/** Stable cache key for an environment's ruleset. No Redis wiring here — key shape only. */
export function rulesetCacheKey(envId: string): string {
  return `ruleset:${envId}`;
}

/**
 * Assembles the per-environment {@link Ruleset} served on the SDK hot path. All
 * reads run on the tenant transaction so RLS scopes them to the caller's org.
 */
@Injectable()
export class RulesetService {
  constructor(@Inject(TenantContextService) private readonly tenant: TenantContextService) {}

  async assemble(environmentId: string): Promise<Ruleset> {
    return this.guarded(async () => {
      const trx = this.tenant.trx;
      const env = await trx
        .selectFrom("environments")
        .select(["ruleset_version"])
        .where("id", "=", environmentId)
        .executeTakeFirst();
      if (!env) throw new DomainException("LOST_OWL", 404, "No such environment");

      const rows = await trx
        .selectFrom("flag_env_configs as c")
        .innerJoin("flags as f", "f.id", "c.flag_id")
        .select(["f.key as key", "c.enabled", "c.default_variation", "c.rules"])
        .where("c.environment_id", "=", environmentId)
        .where("f.archived_at", "is", null)
        .execute();

      const flags = rows
        .map(rowToFlagConfig)
        .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

      return {
        environmentId,
        version: Number(env.ruleset_version),
        schemaVersion: 1,
        flags,
      };
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
