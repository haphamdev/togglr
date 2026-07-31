import { createHash, randomBytes } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { SdkKey, SdkKeySecret } from "@togglr/shared-types";
import type { Transaction } from "kysely";
import { type Kysely, sql } from "kysely";
import { DomainException } from "../../common/domain-exception";
import { AppConfigService } from "../../config/app-config.service";
import { type Database, KYSELY } from "../../db/database";
import { TenantContextService } from "../tenant/tenant-context.service";

interface KeyRow {
  id: string;
  prefix: string;
  name: string | null;
  status: string;
  last_used_at: Date | null;
  expires_at: Date | null;
  created_at: Date;
}

interface SecretRow {
  id: string;
  prefix: string;
  name: string | null;
  expires_at: Date | null;
  created_at: Date;
}

interface ResolveRow {
  organization_id: string;
  environment_id: string;
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

function toIsoOrNull(v: Date | string | null): string | null {
  if (v === null) return null;
  return (v instanceof Date ? v : new Date(v)).toISOString();
}
function toIso(v: Date | string): string {
  return (v instanceof Date ? v : new Date(v)).toISOString();
}

/** `tgl_<envPrefix>_<random>` where envPrefix = first 12 hex of the env UUID. */
function generateKey(environmentId: string): { secret: string; prefix: string; keyHash: string } {
  const envPrefix = environmentId.replace(/-/g, "").slice(0, 12).toLowerCase();
  const random = randomBytes(32).toString("base64url");
  const secret = `tgl_${envPrefix}_${random}`;
  return { secret, prefix: `tgl_${envPrefix}`, keyHash: sha256(secret) };
}

/** Prefix = first two `_`-segments; the random tail may itself contain `_`, so
 * the whole presented string is hashed (never the split tail). */
function parsePresented(presented: string): { prefix: string; keyHash: string } {
  const prefix = presented.split("_").slice(0, 2).join("_");
  return { prefix, keyHash: sha256(presented) };
}

function toSdkKey(r: KeyRow): SdkKey {
  return {
    id: r.id,
    prefix: r.prefix,
    name: r.name,
    status: r.status as SdkKey["status"],
    lastUsedAt: toIsoOrNull(r.last_used_at),
    expiresAt: toIsoOrNull(r.expires_at),
    createdAt: toIso(r.created_at),
  };
}

function toSecret(r: SecretRow, secret: string): SdkKeySecret {
  return {
    id: r.id,
    secret,
    prefix: r.prefix,
    name: r.name,
    status: "active",
    expiresAt: toIsoOrNull(r.expires_at),
    createdAt: toIso(r.created_at),
  };
}

/**
 * Per-environment SDK keys. Control-plane methods run on the tenant transaction
 * (RLS-scoped). `validate` is the hot-path bootstrap read: it uses the
 * `app_sdk_key_resolve` SECURITY DEFINER function on the raw pool (which also
 * bumps `last_used_at`) — no org context exists yet on an inbound SDK request.
 */
@Injectable()
export class SdkKeyService {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<Database>,
    @Inject(TenantContextService) private readonly tenant: TenantContextService,
    @Inject(AppConfigService) private readonly config: AppConfigService,
  ) {}

  private async resolveEnvId(
    trx: Transaction<Database>,
    projectKey: string,
    envKey: string,
  ): Promise<string> {
    const row = await trx
      .selectFrom("environments as e")
      .innerJoin("projects as p", "p.id", "e.project_id")
      .select("e.id")
      .where("p.key", "=", projectKey)
      .where("e.key", "=", envKey)
      .executeTakeFirst();
    if (!row) throw new DomainException("LOST_OWL", 404, "No such environment in this project");
    return row.id;
  }

  async issue(projectKey: string, envKey: string, name: string | null): Promise<SdkKeySecret> {
    return this.guarded(async () => {
      const trx = this.tenant.trx;
      const envId = await this.resolveEnvId(trx, projectKey, envKey);
      const { secret, prefix, keyHash } = generateKey(envId);
      const row = await trx
        .insertInto("sdk_keys")
        .values({
          organization_id: this.tenant.orgId,
          environment_id: envId,
          prefix,
          key_hash: keyHash,
          name,
          status: "active",
          expires_at: null,
        })
        .returning(["id", "prefix", "name", "expires_at", "created_at"])
        .executeTakeFirstOrThrow();
      return toSecret(row, secret);
    });
  }

  async list(projectKey: string, envKey: string): Promise<SdkKey[]> {
    return this.guarded(async () => {
      const trx = this.tenant.trx;
      const envId = await this.resolveEnvId(trx, projectKey, envKey);
      const rows = await trx
        .selectFrom("sdk_keys")
        .select(["id", "prefix", "name", "status", "last_used_at", "expires_at", "created_at"])
        .where("environment_id", "=", envId)
        .orderBy("created_at", "desc")
        .execute();
      return rows.map(toSdkKey);
    });
  }

  async rotate(
    projectKey: string,
    envKey: string,
    keyId: string,
  ): Promise<{
    newKey: SdkKeySecret;
    rotatedKey: { id: string; status: "active"; expiresAt: string };
  }> {
    return this.guarded(async () => {
      const trx = this.tenant.trx;
      const envId = await this.resolveEnvId(trx, projectKey, envKey);

      const existing = await trx
        .selectFrom("sdk_keys")
        .select("id")
        .where("id", "=", keyId)
        .where("environment_id", "=", envId)
        .executeTakeFirst();
      if (!existing) throw new DomainException("LOST_OWL", 404, "No such key in this environment");

      const { secret, prefix, keyHash } = generateKey(envId);
      const newRow = await trx
        .insertInto("sdk_keys")
        .values({
          organization_id: this.tenant.orgId,
          environment_id: envId,
          prefix,
          key_hash: keyHash,
          name: null,
          status: "active",
          expires_at: null,
        })
        .returning(["id", "prefix", "name", "expires_at", "created_at"])
        .executeTakeFirstOrThrow();

      const graceExpiry = new Date(Date.now() + this.config.sdkKeyRotationGraceS * 1000);
      const rotated = await trx
        .updateTable("sdk_keys")
        .set({ expires_at: graceExpiry })
        .where("id", "=", keyId)
        .returning(["id", "expires_at"])
        .executeTakeFirstOrThrow();

      return {
        newKey: toSecret(newRow, secret),
        rotatedKey: {
          id: rotated.id,
          status: "active",
          expiresAt: toIso(rotated.expires_at as Date),
        },
      };
    });
  }

  async revoke(projectKey: string, envKey: string, keyId: string): Promise<void> {
    await this.guarded(async () => {
      const trx = this.tenant.trx;
      const envId = await this.resolveEnvId(trx, projectKey, envKey);
      const res = await trx
        .updateTable("sdk_keys")
        .set({ status: "revoked" })
        .where("id", "=", keyId)
        .where("environment_id", "=", envId)
        .executeTakeFirst();
      if (Number(res.numUpdatedRows ?? 0) === 0) {
        throw new DomainException("LOST_OWL", 404, "No such key in this environment");
      }
    });
  }

  /** Hot-path validation of a presented key. Returns the org + environment for an
   * active, in-grace key (and bumps last_used_at), or null when denied. */
  async validate(presented: string): Promise<{ orgId: string; environmentId: string } | null> {
    const { prefix, keyHash } = parsePresented(presented);
    const result = await this.guarded(() =>
      sql<ResolveRow>`
        SELECT organization_id, environment_id FROM app_sdk_key_resolve(${prefix}, ${keyHash})
      `.execute(this.db),
    );
    const row = result.rows[0];
    if (!row) return null;
    return { orgId: row.organization_id, environmentId: row.environment_id };
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
