import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { OrgRole, OrgSummary } from "@togglr/shared-types";
import { type Kysely, sql } from "kysely";
import { DomainException } from "../common/domain-exception";
import { type Database, KYSELY } from "../db/database";
import { TenantContextService } from "./tenant/tenant-context.service";

interface OrgListRow {
  slug: string;
  name: string;
  role: string;
  created_at: Date;
}

/** True for a Postgres unique-constraint violation. */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "23505"
  );
}

function toIso(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

@Injectable()
export class OrgService {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<Database>,
    @Inject(TenantContextService) private readonly tenant: TenantContextService,
  ) {}

  /** Create an org; the caller becomes its owner. Generates the org id up front
   * and sets it as the RLS context in the same transaction so the initial
   * organizations + memberships inserts pass `WITH CHECK` (AC5). */
  async create(userId: string, input: { name: string; slug: string }): Promise<OrgSummary> {
    const orgId = randomUUID();
    return this.guarded(() =>
      this.db.transaction().execute(async (trx) => {
        await sql`SELECT set_config('app.current_org', ${orgId}, true)`.execute(trx);
        let org: { slug: string; name: string; created_at: Date };
        try {
          org = await trx
            .insertInto("organizations")
            .values({ id: orgId, name: input.name, slug: input.slug })
            .returning(["slug", "name", "created_at"])
            .executeTakeFirstOrThrow();
        } catch (err) {
          if (isUniqueViolation(err)) {
            throw new DomainException("FUNNY_PIG", 409, "Org slug already in use");
          }
          throw err;
        }
        await trx
          .insertInto("memberships")
          .values({ organization_id: orgId, user_id: userId, role: "owner" })
          .execute();
        return { slug: org.slug, name: org.name, role: "owner", createdAt: toIso(org.created_at) };
      }),
    );
  }

  /** List the orgs a user belongs to (cross-tenant bootstrap read). */
  async listForUser(userId: string): Promise<OrgSummary[]> {
    const result = await this.guarded(() =>
      sql<OrgListRow>`
        SELECT slug, name, role, created_at FROM app_user_memberships(${userId})
      `.execute(this.db),
    );
    return result.rows.map((r) => ({
      slug: r.slug,
      name: r.name,
      role: r.role as OrgRole,
      createdAt: toIso(r.created_at),
    }));
  }

  /** Current org detail (read inside the tenant transaction; RLS-scoped). */
  async getCurrent(): Promise<OrgSummary> {
    const org = await this.guarded(() =>
      this.tenant.trx
        .selectFrom("organizations")
        .select(["slug", "name", "created_at"])
        .where("id", "=", this.tenant.orgId)
        .executeTakeFirstOrThrow(),
    );
    return {
      slug: org.slug,
      name: org.name,
      role: this.tenant.role,
      createdAt: toIso(org.created_at),
    };
  }

  /** Rename the current org (name only; slug immutable). Owner-gated by the guard. */
  async rename(name: string): Promise<OrgSummary> {
    const org = await this.guarded(() =>
      this.tenant.trx
        .updateTable("organizations")
        .set({ name })
        .where("id", "=", this.tenant.orgId)
        .returning(["slug", "name", "created_at"])
        .executeTakeFirstOrThrow(),
    );
    return {
      slug: org.slug,
      name: org.name,
      role: this.tenant.role,
      createdAt: toIso(org.created_at),
    };
  }

  /** Map any datastore error to 503 DIZZY_OWL; pass DomainExceptions through. */
  private async guarded<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof DomainException) throw err;
      throw new DomainException("DIZZY_OWL", 503, "datastore unavailable");
    }
  }
}
