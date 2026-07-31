import { Inject, Injectable } from "@nestjs/common";
import type { Environment } from "@togglr/shared-types";
import type { Transaction } from "kysely";
import { DomainException } from "../common/domain-exception";
import type { Database } from "../db/database";
import { TenantContextService } from "./tenant/tenant-context.service";

interface EnvRow {
  key: string;
  name: string;
  ruleset_version: number | string;
  created_at: Date;
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
function toEnv(r: EnvRow): Environment {
  return {
    key: r.key,
    name: r.name,
    rulesetVersion: Number(r.ruleset_version),
    createdAt: toIso(r.created_at),
  };
}

/** Environments within a project (additive to the seeded set). */
@Injectable()
export class EnvironmentsService {
  constructor(@Inject(TenantContextService) private readonly tenant: TenantContextService) {}

  /** Resolve the parent project id by key within the tenant tx; unknown → LOST_OWL. */
  private async projectId(trx: Transaction<Database>, projectKey: string): Promise<string> {
    const project = await trx
      .selectFrom("projects")
      .select("id")
      .where("key", "=", projectKey)
      .executeTakeFirst();
    if (!project) throw new DomainException("LOST_OWL", 404, "No such project in this org");
    return project.id;
  }

  async create(projectKey: string, input: { key: string; name: string }): Promise<Environment> {
    return this.guarded(async () => {
      const trx = this.tenant.trx;
      const projectId = await this.projectId(trx, projectKey);
      try {
        const row = await trx
          .insertInto("environments")
          .values({
            organization_id: this.tenant.orgId,
            project_id: projectId,
            key: input.key,
            name: input.name,
          })
          .returning(["key", "name", "ruleset_version", "created_at"])
          .executeTakeFirstOrThrow();
        return toEnv(row);
      } catch (err) {
        if (isUniqueViolation(err)) {
          throw new DomainException(
            "NOISY_DUCK",
            409,
            "Environment key already used in this project",
          );
        }
        throw err;
      }
    });
  }

  async list(projectKey: string): Promise<Environment[]> {
    return this.guarded(async () => {
      const trx = this.tenant.trx;
      const projectId = await this.projectId(trx, projectKey);
      const rows = await trx
        .selectFrom("environments")
        .select(["key", "name", "ruleset_version", "created_at"])
        .where("project_id", "=", projectId)
        .orderBy("created_at")
        .execute();
      return rows.map(toEnv);
    });
  }

  async get(projectKey: string, envKey: string): Promise<Environment> {
    return this.guarded(async () => {
      const trx = this.tenant.trx;
      const projectId = await this.projectId(trx, projectKey);
      const row = await trx
        .selectFrom("environments")
        .select(["key", "name", "ruleset_version", "created_at"])
        .where("project_id", "=", projectId)
        .where("key", "=", envKey)
        .executeTakeFirst();
      if (!row) throw new DomainException("LOST_OWL", 404, "No such environment in this project");
      return toEnv(row);
    });
  }

  async rename(projectKey: string, envKey: string, name: string): Promise<Environment> {
    return this.guarded(async () => {
      const trx = this.tenant.trx;
      const projectId = await this.projectId(trx, projectKey);
      const row = await trx
        .updateTable("environments")
        .set({ name })
        .where("project_id", "=", projectId)
        .where("key", "=", envKey)
        .returning(["key", "name", "ruleset_version", "created_at"])
        .executeTakeFirst();
      if (!row) throw new DomainException("LOST_OWL", 404, "No such environment in this project");
      return toEnv(row);
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
