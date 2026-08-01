import { Inject, Injectable } from "@nestjs/common";
import type { FlagEnvConfigSummary, FlagWithEnvironments, Variation } from "@togglr/shared-types";
import { type RawBuilder, sql, type Transaction } from "kysely";
import { DomainException } from "../common/domain-exception";
import type { Database } from "../db/database";
import { TenantContextService } from "../org/tenant/tenant-context.service";

interface FlagSummaryRow {
  flag_key: string;
  description: string | null;
  type: string;
  archived_at: Date | null;
  created_at: Date;
  env_key: string;
  enabled: boolean;
  default_variation: unknown;
  rule_count: number | string;
  config_version: number | string;
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "23505"
  );
}
function toIso(v: Date | string): string {
  return (v instanceof Date ? v : new Date(v)).toISOString();
}

/** Validate a flag key; not enforced by the controller's Zod → service throws. */
export function assertValidFlagKey(key: string): void {
  if (!/^[a-z0-9-]+$/.test(key)) {
    throw new DomainException("GRUMPY_CAT", 400, "Flag key must match ^[a-z0-9-]+$");
  }
}

/** Project-scoped flag CRUD (create/list/get/metadata-patch). All queries run on the tenant tx. */
@Injectable()
export class FlagsService {
  constructor(@Inject(TenantContextService) private readonly tenant: TenantContextService) {}

  /** Resolve the parent project id by key within the tenant tx; unknown → LOST_OWL. */
  private async resolveProjectId(trx: Transaction<Database>, projectKey: string): Promise<string> {
    const project = await trx
      .selectFrom("projects")
      .select("id")
      .where("key", "=", projectKey)
      .executeTakeFirst();
    if (!project) throw new DomainException("LOST_OWL", 404, "No such project in this org");
    return project.id;
  }

  /** Single joined query (no N+1); rows grouped in JS preserving flag/env order. */
  private async loadFlags(
    trx: Transaction<Database>,
    projectId: string,
    opts: { includeArchived: boolean; flagKey?: string },
  ): Promise<FlagWithEnvironments[]> {
    let q = trx
      .selectFrom("flags as f")
      .innerJoin("flag_env_configs as c", "c.flag_id", "f.id")
      .innerJoin("environments as e", "e.id", "c.environment_id")
      .select([
        "f.key as flag_key",
        "f.description",
        "f.type",
        "f.archived_at",
        "f.created_at",
        "e.key as env_key",
        "c.enabled",
        "c.default_variation",
        "c.config_version",
        sql<number>`jsonb_array_length(c.rules)`.as("rule_count"),
      ])
      .where("f.project_id", "=", projectId)
      .orderBy("f.created_at")
      .orderBy("e.created_at");
    if (!opts.includeArchived) q = q.where("f.archived_at", "is", null);
    if (opts.flagKey) q = q.where("f.key", "=", opts.flagKey);
    const rows = (await q.execute()) as FlagSummaryRow[];

    const byFlag = new Map<string, FlagWithEnvironments>();
    for (const r of rows) {
      let flag = byFlag.get(r.flag_key);
      if (!flag) {
        flag = {
          key: r.flag_key,
          description: r.description,
          type: r.type as "boolean",
          archivedAt: r.archived_at ? toIso(r.archived_at) : null,
          createdAt: toIso(r.created_at),
          environments: [],
        };
        byFlag.set(r.flag_key, flag);
      }
      const env: FlagEnvConfigSummary = {
        envKey: r.env_key,
        enabled: r.enabled,
        defaultVariation: r.default_variation as Variation,
        ruleCount: Number(r.rule_count),
        configVersion: Number(r.config_version),
      };
      flag.environments.push(env);
    }
    return [...byFlag.values()];
  }

  /** Create a flag + seed a config row in every environment of the project (AC1/AC4). */
  async create(
    projectKey: string,
    input: { key: string; description?: string; type?: "boolean" },
  ): Promise<FlagWithEnvironments> {
    return this.guarded(async () => {
      assertValidFlagKey(input.key);
      const trx = this.tenant.trx;
      const projectId = await this.resolveProjectId(trx, projectKey);

      let flag: { id: string };
      try {
        flag = await trx
          .insertInto("flags")
          .values({
            organization_id: this.tenant.orgId,
            project_id: projectId,
            key: input.key,
            description: input.description ?? null,
            type: input.type ?? "boolean",
          })
          .returning(["id"])
          .executeTakeFirstOrThrow();
      } catch (err) {
        if (isUniqueViolation(err)) {
          throw new DomainException("FAT_CAT", 409, "Flag key already used in this project");
        }
        throw err;
      }

      const envs = await trx
        .selectFrom("environments")
        .select(["id"])
        .where("project_id", "=", projectId)
        .execute();
      if (envs.length > 0) {
        await trx
          .insertInto("flag_env_configs")
          .values(
            envs.map((e) => ({
              organization_id: this.tenant.orgId,
              flag_id: flag.id,
              environment_id: e.id,
            })),
          )
          .execute();
      }

      const [created] = await this.loadFlags(trx, projectId, {
        includeArchived: true,
        flagKey: input.key,
      });
      // Invariant: a just-created flag always has ≥1 seeded env config to summarize.
      // Unreachable unless the project has zero environments; surfaces as 503 via guarded().
      if (!created) throw new Error("flag created without an environment config to summarize");
      return created;
    });
  }

  async list(projectKey: string, includeArchived: boolean): Promise<FlagWithEnvironments[]> {
    return this.guarded(async () => {
      const trx = this.tenant.trx;
      const projectId = await this.resolveProjectId(trx, projectKey);
      return this.loadFlags(trx, projectId, { includeArchived });
    });
  }

  async get(projectKey: string, flagKey: string): Promise<FlagWithEnvironments> {
    return this.guarded(async () => {
      const trx = this.tenant.trx;
      const projectId = await this.resolveProjectId(trx, projectKey);
      const [flag] = await this.loadFlags(trx, projectId, { includeArchived: true, flagKey });
      if (!flag) throw new DomainException("LOST_OWL", 404, "No such flag in this project");
      return flag;
    });
  }

  /** Metadata-only PATCH: description + reversible archive. key/type are immutable (AC5). */
  async patch(
    projectKey: string,
    flagKey: string,
    patch: { description?: string | null; archived?: boolean },
  ): Promise<FlagWithEnvironments> {
    return this.guarded(async () => {
      const trx = this.tenant.trx;
      const projectId = await this.resolveProjectId(trx, projectKey);
      const set: { description?: string | null; archived_at?: Date | null | RawBuilder<Date> } = {};
      if (patch.description !== undefined) set.description = patch.description;
      if (patch.archived !== undefined) {
        // Re-archiving preserves the original archived_at (COALESCE); restore clears it.
        set.archived_at = patch.archived ? sql<Date>`coalesce(archived_at, now())` : null;
      }
      // Nothing to change (the controller's Zod refine normally prevents this).
      if (Object.keys(set).length === 0) return this.get(projectKey, flagKey);
      const updated = await trx
        .updateTable("flags")
        .set(set)
        .where("project_id", "=", projectId)
        .where("key", "=", flagKey)
        .returning(["id"])
        .executeTakeFirst();
      if (!updated) throw new DomainException("LOST_OWL", 404, "No such flag in this project");
      const [flag] = await this.loadFlags(trx, projectId, { includeArchived: true, flagKey });
      if (!flag) throw new DomainException("LOST_OWL", 404, "No such flag in this project");
      return flag;
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
