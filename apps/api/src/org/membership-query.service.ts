import { Inject, Injectable } from "@nestjs/common";
import type { Membership, OrgRole } from "@togglr/shared-types";
import { type Kysely, sql } from "kysely";
import { DomainException } from "../common/domain-exception";
import { type Database, KYSELY } from "../db/database";

interface MembershipRow {
  slug: string;
  name: string;
  role: string;
}

/**
 * Bootstrap cross-tenant read of a user's memberships, exposed to AuthModule so
 * `/auth/me` and login/signup can return the seam. Uses the `app_user_memberships`
 * SECURITY DEFINER function on the raw pool (a user's org list is inherently
 * cross-tenant and cannot run under a single org's RLS context).
 */
@Injectable()
export class MembershipQueryService {
  constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

  async listForUser(userId: string): Promise<Membership[]> {
    const result = await this.guarded(() =>
      sql<MembershipRow>`SELECT slug, name, role FROM app_user_memberships(${userId})`.execute(
        this.db,
      ),
    );
    return result.rows.map((r) => ({ slug: r.slug, name: r.name, role: r.role as OrgRole }));
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
