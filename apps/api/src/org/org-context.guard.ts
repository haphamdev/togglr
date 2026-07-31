import { type CanActivate, type ExecutionContext, Inject, Injectable } from "@nestjs/common";
import type { OrgRole } from "@togglr/shared-types";
import { type Kysely, sql } from "kysely";
import type { AuthedRequest } from "../auth/authed-request";
import { DomainException } from "../common/domain-exception";
import { type Database, KYSELY } from "../db/database";

interface ResolveRow {
  organization_id: string;
  role: string | null;
}

/**
 * Resolves the org context for `:orgSlug` routes. Uses the `app_resolve_membership`
 * SECURITY DEFINER function (a sanctioned bootstrap read on the raw pool, run
 * before any tenant context exists) to look up the org + caller's role:
 * - unknown slug (0 rows) → `404 LOST_OWL`
 * - org exists but caller not a member (NULL role) → `403 LONELY_OWL`
 * On success sets `req.orgContext = { orgId, role }` for RolesGuard + the
 * interceptor. Runs after the global SessionGuard, so `req.session` is present.
 */
@Injectable()
export class OrgContextGuard implements CanActivate {
  constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const userId = req.session?.userId;
    if (!userId) throw new DomainException("SLEEPY_OWL", 401, "Missing or invalid session");

    const slug = req.params?.orgSlug;
    if (!slug) throw new DomainException("LOST_OWL", 404, "Organization not found");

    const result = await this.query(() =>
      sql<ResolveRow>`
        SELECT organization_id, role FROM app_resolve_membership(${userId}, ${slug})
      `.execute(this.db),
    );
    const row = result.rows[0];
    if (!row) throw new DomainException("LOST_OWL", 404, "Organization not found");
    if (row.role === null) {
      throw new DomainException("LONELY_OWL", 403, "Not a member of this organization");
    }

    req.orgContext = { orgId: row.organization_id, role: row.role as OrgRole };
    return true;
  }

  private async query<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof DomainException) throw err;
      throw new DomainException("DIZZY_OWL", 503, "datastore unavailable");
    }
  }
}
