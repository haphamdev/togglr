import { Inject, Injectable } from "@nestjs/common";
import type { Environment, Project } from "@togglr/shared-types";
import { DomainException } from "../common/domain-exception";
import { TenantContextService } from "./tenant/tenant-context.service";

interface ProjectRow {
  key: string;
  name: string;
  created_at: Date;
}
interface EnvRow {
  key: string;
  name: string;
  ruleset_version: number | string;
  archived_at: Date | null;
  created_at: Date;
}

const SEED_ENVIRONMENTS: ReadonlyArray<{ key: string; name: string }> = [
  { key: "development", name: "Development" },
  { key: "staging", name: "Staging" },
  { key: "production", name: "Production" },
];

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
function toProject(r: ProjectRow): Project {
  return { key: r.key, name: r.name, createdAt: toIso(r.created_at) };
}
function toEnv(r: EnvRow): Environment {
  return {
    key: r.key,
    name: r.name,
    rulesetVersion: Number(r.ruleset_version),
    archivedAt: r.archived_at ? toIso(r.archived_at) : null,
    createdAt: toIso(r.created_at),
  };
}

/** Projects for the current org. All queries run on the tenant transaction. */
@Injectable()
export class ProjectsService {
  constructor(@Inject(TenantContextService) private readonly tenant: TenantContextService) {}

  /** Create a project + seed the three default environments (all version 0). */
  async create(input: {
    key: string;
    name: string;
  }): Promise<{ project: Project; environments: Environment[] }> {
    return this.guarded(async () => {
      const trx = this.tenant.trx;
      const orgId = this.tenant.orgId;

      let project: ProjectRow & { id: string };
      try {
        project = await trx
          .insertInto("projects")
          .values({ organization_id: orgId, key: input.key, name: input.name })
          .returning(["id", "key", "name", "created_at"])
          .executeTakeFirstOrThrow();
      } catch (err) {
        if (isUniqueViolation(err)) {
          throw new DomainException("SLEEPY_DOG", 409, "Project key already used in this org");
        }
        throw err;
      }

      const envRows = await trx
        .insertInto("environments")
        .values(
          SEED_ENVIRONMENTS.map((e) => ({
            organization_id: orgId,
            project_id: project.id,
            key: e.key,
            name: e.name,
          })),
        )
        .returning(["key", "name", "ruleset_version", "archived_at", "created_at"])
        .execute();

      const environments = SEED_ENVIRONMENTS.map((seed) => {
        const row = envRows.find((r) => r.key === seed.key);
        if (!row) throw new Error("seeded environment missing from insert result");
        return toEnv(row);
      });

      return { project: toProject(project), environments };
    });
  }

  async list(): Promise<Project[]> {
    const rows = await this.guarded(() =>
      this.tenant.trx
        .selectFrom("projects")
        .select(["key", "name", "created_at"])
        .orderBy("created_at")
        .execute(),
    );
    return rows.map(toProject);
  }

  async get(projectKey: string): Promise<Project> {
    const row = await this.guarded(() =>
      this.tenant.trx
        .selectFrom("projects")
        .select(["key", "name", "created_at"])
        .where("key", "=", projectKey)
        .executeTakeFirst(),
    );
    if (!row) throw new DomainException("LOST_OWL", 404, "No such project in this org");
    return toProject(row);
  }

  async rename(projectKey: string, name: string): Promise<Project> {
    const row = await this.guarded(() =>
      this.tenant.trx
        .updateTable("projects")
        .set({ name })
        .where("key", "=", projectKey)
        .returning(["key", "name", "created_at"])
        .executeTakeFirst(),
    );
    if (!row) throw new DomainException("LOST_OWL", 404, "No such project in this org");
    return toProject(row);
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
