import { Inject, Injectable } from "@nestjs/common";
import type { Member, OrgRole } from "@togglr/shared-types";
import { DomainException } from "../common/domain-exception";
import { TenantContextService } from "./tenant/tenant-context.service";

interface MemberRow {
  user_id: string;
  email: string;
  name: string | null;
  role: string;
  created_at: Date;
}

function toIso(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function toMember(r: MemberRow): Member {
  return {
    userId: r.user_id,
    email: r.email,
    name: r.name,
    role: r.role as OrgRole,
    createdAt: toIso(r.created_at),
  };
}

/**
 * Member reads/writes for the current org. Every query runs on
 * `tenantContext.trx`, so RLS scopes memberships to `app.current_org`; the join
 * to the global `users` table (no RLS) is safe. Role gating is handled by
 * RolesGuard (owner-only mutations); this service owns the last-owner invariant.
 */
@Injectable()
export class MembersService {
  constructor(@Inject(TenantContextService) private readonly tenant: TenantContextService) {}

  async list(): Promise<Member[]> {
    const rows = await this.guarded(() =>
      this.tenant.trx
        .selectFrom("memberships as m")
        .innerJoin("users as u", "u.id", "m.user_id")
        .select([
          "m.user_id as user_id",
          "u.email",
          "u.name",
          "m.role",
          "m.created_at as created_at",
        ])
        .orderBy("m.created_at")
        .execute(),
    );
    return rows.map(toMember);
  }

  async updateRole(targetUserId: string, role: OrgRole): Promise<Member> {
    return this.guarded(async () => {
      const target = await this.tenant.trx
        .selectFrom("memberships")
        .select("role")
        .where("user_id", "=", targetUserId)
        .executeTakeFirst();
      if (!target) throw new DomainException("LOST_OWL", 404, "No such member in this org");

      // Demoting the last owner would leave the org ownerless.
      if (target.role === "owner" && role !== "owner") await this.ensureNotLastOwner();

      await this.tenant.trx
        .updateTable("memberships")
        .set({ role })
        .where("user_id", "=", targetUserId)
        .execute();
      return this.fetchMember(targetUserId);
    });
  }

  async remove(targetUserId: string): Promise<void> {
    await this.guarded(async () => {
      const target = await this.tenant.trx
        .selectFrom("memberships")
        .select("role")
        .where("user_id", "=", targetUserId)
        .executeTakeFirst();
      if (!target) throw new DomainException("LOST_OWL", 404, "No such member in this org");

      if (target.role === "owner") await this.ensureNotLastOwner();

      await this.tenant.trx.deleteFrom("memberships").where("user_id", "=", targetUserId).execute();
    });
  }

  /** Throws LONELY_RAM when the org has exactly one owner. */
  private async ensureNotLastOwner(): Promise<void> {
    const row = await this.tenant.trx
      .selectFrom("memberships")
      .select((eb) => eb.fn.countAll<string>().as("n"))
      .where("role", "=", "owner")
      .executeTakeFirstOrThrow();
    if (Number(row.n) <= 1) {
      throw new DomainException("LONELY_RAM", 409, "Would leave the org without an owner");
    }
  }

  private async fetchMember(userId: string): Promise<Member> {
    const row = await this.tenant.trx
      .selectFrom("memberships as m")
      .innerJoin("users as u", "u.id", "m.user_id")
      .select(["m.user_id as user_id", "u.email", "u.name", "m.role", "m.created_at as created_at"])
      .where("m.user_id", "=", userId)
      .executeTakeFirstOrThrow();
    return toMember(row);
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
