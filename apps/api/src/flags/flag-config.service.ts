import { Inject, Injectable } from "@nestjs/common";
import type {
  FlagEnvConfigDetail,
  FlagEnvConfigUpdated,
  Rule,
  Variation,
} from "@togglr/shared-types";
import { type RawBuilder, sql, type Transaction } from "kysely";
import { DomainException } from "../common/domain-exception";
import type { Database } from "../db/database";
import { TenantContextService } from "../org/tenant/tenant-context.service";

const OPERATORS: Record<string, true> = {
  equals: true,
  "not-equals": true,
  in: true,
  "not-in": true,
};

function toIso(v: Date | string): string {
  return (v instanceof Date ? v : new Date(v)).toISOString();
}
function curious(msg: string): DomainException {
  return new DomainException("CURIOUS_CAT", 400, msg);
}

/** Structural rule validation; malformed → CURIOUS_CAT (the controller's Zod stays shallow,
 *  so deep rule errors surface here, not as CLUMSY_OWL). An empty array is valid. */
export function assertValidRules(rules: unknown[]): void {
  rules.forEach((rule, i) => {
    if (typeof rule !== "object" || rule === null) throw curious(`rules[${i}] must be an object`);
    const r = rule as { conditions?: unknown; result?: unknown };
    if (!Array.isArray(r.conditions)) throw curious(`rules[${i}].conditions must be an array`);
    r.conditions.forEach((c, j) => {
      const cond = c as { attribute?: unknown; operator?: unknown; values?: unknown };
      if (typeof cond?.attribute !== "string" || cond.attribute.length === 0)
        throw curious(`rules[${i}].conditions[${j}].attribute is required`);
      if (typeof cond?.operator !== "string" || !OPERATORS[cond.operator])
        throw curious(`rules[${i}].conditions[${j}].operator is invalid`);
      if (!Array.isArray(cond?.values) || cond.values.length === 0)
        throw curious(`rules[${i}].conditions[${j}].values must be non-empty`);
    });
    const result = r.result as
      | { kind?: unknown; variation?: unknown; percentage?: unknown; bucketBy?: unknown }
      | undefined;
    if (typeof result?.variation !== "boolean")
      throw curious(`rules[${i}].result.variation must be a boolean`);
    if (result.kind === "variation") {
      // boolean MVP: variation already checked
    } else if (result.kind === "rollout") {
      if (
        typeof result.percentage !== "number" ||
        !Number.isInteger(result.percentage) ||
        result.percentage < 0 ||
        result.percentage > 100
      )
        throw curious(`rules[${i}].result.percentage must be an integer in 0..100`);
      if (typeof result.bucketBy !== "string" || result.bucketBy.length === 0)
        throw curious(`rules[${i}].result.bucketBy is required`);
    } else {
      throw curious(`rules[${i}].result.kind must be "variation" or "rollout"`);
    }
  });
}

/** Per-(flag, environment) config edit. All queries run on the tenant transaction. */
@Injectable()
export class FlagConfigService {
  constructor(@Inject(TenantContextService) private readonly tenant: TenantContextService) {}

  /** Resolve flag/env ids AND the current config snapshot by keys within the tenant tx; any
   *  miss (unknown project, flag, env, or no seeded config row) → LOST_OWL. The snapshot is the
   *  audit `before` and doubles as the row the optimistic-concurrency UPDATE then guards. */
  private async resolveConfig(
    trx: Transaction<Database>,
    projectKey: string,
    flagKey: string,
    envKey: string,
  ): Promise<{
    flagId: string;
    environmentId: string;
    configId: string;
    before: { enabled: boolean; defaultVariation: unknown; rules: unknown; configVersion: number };
  }> {
    const row = await trx
      .selectFrom("flags as f")
      .innerJoin("projects as p", "p.id", "f.project_id")
      .innerJoin("flag_env_configs as c", "c.flag_id", "f.id")
      .innerJoin("environments as e", "e.id", "c.environment_id")
      .select([
        "f.id as flag_id",
        "e.id as environment_id",
        "c.id as config_id",
        "c.enabled",
        "c.default_variation",
        "c.rules",
        "c.config_version",
      ])
      .where("p.key", "=", projectKey)
      .where("f.key", "=", flagKey)
      .where("e.key", "=", envKey)
      .executeTakeFirst();
    if (!row) throw new DomainException("LOST_OWL", 404, "No such flag config in this project");
    return {
      flagId: row.flag_id,
      environmentId: row.environment_id,
      configId: row.config_id,
      before: {
        enabled: row.enabled,
        defaultVariation: row.default_variation,
        rules: row.rules,
        configVersion: Number(row.config_version),
      },
    };
  }

  async get(projectKey: string, flagKey: string, envKey: string): Promise<FlagEnvConfigDetail> {
    return this.guarded(async () => {
      const trx = this.tenant.trx;
      const row = await trx
        .selectFrom("flags as f")
        .innerJoin("projects as p", "p.id", "f.project_id")
        .innerJoin("flag_env_configs as c", "c.flag_id", "f.id")
        .innerJoin("environments as e", "e.id", "c.environment_id")
        .select(["c.enabled", "c.default_variation", "c.rules", "c.config_version", "c.updated_at"])
        .where("p.key", "=", projectKey)
        .where("f.key", "=", flagKey)
        .where("e.key", "=", envKey)
        .executeTakeFirst();
      if (!row) throw new DomainException("LOST_OWL", 404, "No such flag config in this project");
      return {
        enabled: row.enabled,
        defaultVariation: row.default_variation as Variation,
        rules: row.rules as Rule[],
        configVersion: Number(row.config_version),
        updatedAt: toIso(row.updated_at),
      };
    });
  }

  async patch(
    projectKey: string,
    flagKey: string,
    envKey: string,
    actorUserId: string,
    input: {
      expectedConfigVersion: number;
      enabled?: boolean;
      defaultVariation?: Variation;
      rules?: unknown[];
    },
  ): Promise<FlagEnvConfigUpdated> {
    return this.guarded(async () => {
      if (input.rules !== undefined) assertValidRules(input.rules);
      const trx = this.tenant.trx;
      const { flagId, environmentId, configId, before } = await this.resolveConfig(
        trx,
        projectKey,
        flagKey,
        envKey,
      );

      const set: {
        enabled?: boolean;
        default_variation?: RawBuilder<unknown>;
        rules?: RawBuilder<unknown>;
        config_version: RawBuilder<number>;
        updated_at: RawBuilder<Date>;
      } = {
        config_version: sql<number>`config_version + 1`,
        updated_at: sql<Date>`now()`,
      };
      if (input.enabled !== undefined) set.enabled = input.enabled;
      if (input.defaultVariation !== undefined)
        set.default_variation = sql`${JSON.stringify(input.defaultVariation)}::jsonb`;
      if (input.rules !== undefined) set.rules = sql`${JSON.stringify(input.rules)}::jsonb`;

      // Optimistic-concurrency write: 0 rows ⇒ version conflict (nothing persisted).
      const after = await trx
        .updateTable("flag_env_configs")
        .set(set)
        .where("id", "=", configId)
        .where("config_version", "=", input.expectedConfigVersion)
        .returning(["enabled", "default_variation", "rules", "config_version", "updated_at"])
        .executeTakeFirst();
      if (!after)
        throw new DomainException("JEALOUS_CAT", 409, "Config version conflict; refetch and retry");

      const env = await trx
        .updateTable("environments")
        .set({ ruleset_version: sql<number>`ruleset_version + 1` })
        .where("id", "=", environmentId)
        .returning(["ruleset_version"])
        .executeTakeFirstOrThrow();

      const afterSnapshot = {
        enabled: after.enabled,
        defaultVariation: after.default_variation,
        rules: after.rules,
        configVersion: Number(after.config_version),
      };
      await trx
        .insertInto("audit_logs")
        .values({
          organization_id: this.tenant.orgId,
          actor_user_id: actorUserId,
          action: "flag_config.update",
          target_type: "flag",
          target_id: flagId,
          environment_id: environmentId,
          before: sql`${JSON.stringify(before)}::jsonb`,
          after: sql`${JSON.stringify(afterSnapshot)}::jsonb`,
        })
        .execute();

      return {
        enabled: after.enabled,
        defaultVariation: after.default_variation as Variation,
        rules: after.rules as Rule[],
        configVersion: Number(after.config_version),
        rulesetVersion: Number(env.ruleset_version),
        updatedAt: toIso(after.updated_at),
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
