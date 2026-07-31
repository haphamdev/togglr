import { createHash, randomBytes } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { Invite, InviteStatus, OrgRole } from "@togglr/shared-types";
import { type Kysely, sql } from "kysely";
import { DomainException } from "../common/domain-exception";
import { AppConfigService } from "../config/app-config.service";
import { type Database, KYSELY } from "../db/database";
import { MailService } from "./mail/mail.service";
import { TenantContextService } from "./tenant/tenant-context.service";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const newToken = () => randomBytes(32).toString("base64url");
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

interface InviteRow {
  id: string;
  email: string;
  role: string;
  status: string;
  expires_at: Date;
  created_at: Date;
}

interface InviteResolveRow {
  id: string;
  organization_id: string;
  org_name: string;
  email: string;
  role: string;
  status: string;
  expires_at: Date;
}

/** A validated invite resolved by token for the accept/preview flows. */
export interface ResolvedInvite {
  id: string;
  organizationId: string;
  orgName: string;
  email: string;
  role: OrgRole;
  expiresAt: Date;
}

function toIso(v: Date | string): string {
  return (v instanceof Date ? v : new Date(v)).toISOString();
}

/** Display status: a still-`pending` row past its expiry reads as `expired`. */
function effectiveStatus(status: string, expiresAt: Date): InviteStatus {
  if (status === "pending" && new Date(expiresAt).getTime() < Date.now()) return "expired";
  return status as InviteStatus;
}

function toInvite(r: InviteRow): Invite {
  return {
    id: r.id,
    email: r.email,
    role: r.role as OrgRole,
    status: effectiveStatus(r.status, r.expires_at),
    expiresAt: toIso(r.expires_at),
    createdAt: toIso(r.created_at),
  };
}

/**
 * Invite token lifecycle + membership linking. Org-side methods (create / list /
 * resend / revoke) run on the tenant transaction (RLS-scoped). Bootstrap methods
 * (resolveOrThrow / accept) run before an org context exists: resolveOrThrow uses
 * the `app_invite_resolve` SECURITY DEFINER function on the raw pool; accept opens
 * its own transaction with the invite's org set as `app.current_org`.
 */
@Injectable()
export class InvitesService {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<Database>,
    @Inject(TenantContextService) private readonly tenant: TenantContextService,
    @Inject(MailService) private readonly mail: MailService,
    @Inject(AppConfigService) private readonly config: AppConfigService,
  ) {}

  // --- Org-side (tenant tx) --------------------------------------------------

  async create(input: { email: string; role: OrgRole }, invitedBy: string): Promise<Invite> {
    return this.guarded(async () => {
      const trx = this.tenant.trx;
      const email = input.email.toLowerCase();

      const member = await trx
        .selectFrom("memberships as m")
        .innerJoin("users as u", "u.id", "m.user_id")
        .select("m.id")
        .where("u.email", "=", email)
        .executeTakeFirst();
      if (member) throw new DomainException("COZY_BEE", 409, "Email already belongs to the org");

      const pending = await trx
        .selectFrom("invites")
        .select("id")
        .where("email", "=", email)
        .where("status", "=", "pending")
        .where("expires_at", ">", new Date())
        .executeTakeFirst();
      if (pending) {
        throw new DomainException(
          "BUSY_BEE",
          409,
          "A pending invite for this email already exists",
        );
      }

      const org = await trx
        .selectFrom("organizations")
        .select("name")
        .where("id", "=", this.tenant.orgId)
        .executeTakeFirstOrThrow();

      const token = newToken();
      const row = await trx
        .insertInto("invites")
        .values({
          organization_id: this.tenant.orgId,
          email,
          role: input.role,
          token_hash: hashToken(token),
          status: "pending",
          expires_at: new Date(Date.now() + SEVEN_DAYS_MS),
          invited_by: invitedBy,
        })
        .returning(["id", "email", "role", "status", "expires_at", "created_at"])
        .executeTakeFirstOrThrow();

      await this.mail.sendInvite({
        email,
        orgName: org.name,
        role: input.role,
        link: `${this.config.webBaseUrl}/invite/${token}`,
      });
      return toInvite(row);
    });
  }

  async list(): Promise<Invite[]> {
    const rows = await this.guarded(() =>
      this.tenant.trx
        .selectFrom("invites")
        .select(["id", "email", "role", "status", "expires_at", "created_at"])
        .where("status", "<>", "accepted")
        .orderBy("created_at", "desc")
        .execute(),
    );
    return rows.map(toInvite);
  }

  async resend(inviteId: string): Promise<Invite> {
    return this.guarded(async () => {
      const trx = this.tenant.trx;
      const existing = await trx
        .selectFrom("invites")
        .select(["email", "role", "status"])
        .where("id", "=", inviteId)
        .executeTakeFirst();
      if (!existing) throw new DomainException("LOST_OWL", 404, "No such invite");
      if (existing.status === "accepted") {
        throw new DomainException("HAPPY_BEE", 409, "Cannot resend a consumed invite");
      }

      const org = await trx
        .selectFrom("organizations")
        .select("name")
        .where("id", "=", this.tenant.orgId)
        .executeTakeFirstOrThrow();

      const token = newToken();
      const row = await trx
        .updateTable("invites")
        .set({
          token_hash: hashToken(token),
          status: "pending",
          expires_at: new Date(Date.now() + SEVEN_DAYS_MS),
        })
        .where("id", "=", inviteId)
        .returning(["id", "email", "role", "status", "expires_at", "created_at"])
        .executeTakeFirstOrThrow();

      await this.mail.sendInvite({
        email: existing.email,
        orgName: org.name,
        role: existing.role as OrgRole,
        link: `${this.config.webBaseUrl}/invite/${token}`,
      });
      return toInvite(row);
    });
  }

  async revoke(inviteId: string): Promise<void> {
    await this.guarded(async () => {
      const res = await this.tenant.trx
        .deleteFrom("invites")
        .where("id", "=", inviteId)
        .executeTakeFirst();
      if (Number(res.numDeletedRows ?? 0) === 0) {
        throw new DomainException("LOST_OWL", 404, "No such invite");
      }
    });
  }

  // --- Bootstrap (raw pool / own tx) -----------------------------------------

  /** Resolve + validate an invite by its plaintext token. Throws the invite
   * lifecycle errors (LOST_BEE / HAPPY_BEE / TIRED_BEE). */
  async resolveOrThrow(token: string): Promise<ResolvedInvite> {
    const result = await this.guarded(() =>
      sql<InviteResolveRow>`
        SELECT id, organization_id, org_name, email, role, status, expires_at
        FROM app_invite_resolve(${hashToken(token)})
      `.execute(this.db),
    );
    const row = result.rows[0];
    if (!row) throw new DomainException("LOST_BEE", 404, "No pending invite for this token");
    if (row.status === "accepted") {
      throw new DomainException("HAPPY_BEE", 409, "Invite already consumed");
    }
    if (new Date(row.expires_at).getTime() < Date.now()) {
      throw new DomainException("TIRED_BEE", 410, "Invite has expired");
    }
    return {
      id: row.id,
      organizationId: row.organization_id,
      orgName: row.org_name,
      email: row.email,
      role: row.role as OrgRole,
      expiresAt: row.expires_at,
    };
  }

  /** Link the membership + mark the invite accepted under the invite's org
   * context. Idempotent: a repeat accept by an existing member is a no-op insert.
   * Returns the org slug for the accept response. */
  async accept(input: {
    inviteId: string;
    orgId: string;
    userId: string;
    role: OrgRole;
  }): Promise<{ slug: string }> {
    return this.guarded(() =>
      this.db.transaction().execute(async (trx) => {
        await sql`SELECT set_config('app.current_org', ${input.orgId}, true)`.execute(trx);
        await trx
          .insertInto("memberships")
          .values({ organization_id: input.orgId, user_id: input.userId, role: input.role })
          .onConflict((oc) => oc.columns(["organization_id", "user_id"]).doNothing())
          .execute();
        await trx
          .updateTable("invites")
          .set({ status: "accepted" })
          .where("id", "=", input.inviteId)
          .execute();
        const org = await trx
          .selectFrom("organizations")
          .select("slug")
          .where("id", "=", input.orgId)
          .executeTakeFirstOrThrow();
        return { slug: org.slug };
      }),
    );
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
