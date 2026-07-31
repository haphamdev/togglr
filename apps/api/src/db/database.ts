import type { Generated } from "kysely";

/**
 * Kysely schema for the control plane. Each table-owning epic augments this
 * interface with its tables. Raw `sql` queries (health probe, boot-safety) work
 * regardless of the declared shape.
 */

/** Global identity table (no RLS, cp:66). `email` stored already-lowercased. */
export interface UsersTable {
  id: Generated<string>;
  email: string;
  password_hash: string;
  name: string | null;
  created_at: Generated<Date>;
}

/** Tenant root. RLS policy keys on `id` (not organization_id). */
export interface OrganizationsTable {
  id: Generated<string>;
  name: string;
  slug: string;
  created_at: Generated<Date>;
}

export interface MembershipsTable {
  id: Generated<string>;
  organization_id: string;
  user_id: string;
  role: string;
  created_at: Generated<Date>;
}

export interface InvitesTable {
  id: Generated<string>;
  organization_id: string;
  email: string;
  role: string;
  token_hash: string;
  status: Generated<string>;
  expires_at: Date;
  invited_by: string | null;
  created_at: Generated<Date>;
}

export interface ProjectsTable {
  id: Generated<string>;
  organization_id: string;
  key: string;
  name: string;
  created_at: Generated<Date>;
}

export interface EnvironmentsTable {
  id: Generated<string>;
  organization_id: string;
  project_id: string;
  key: string;
  name: string;
  ruleset_version: Generated<number>;
  created_at: Generated<Date>;
}

export interface SdkKeysTable {
  id: Generated<string>;
  organization_id: string;
  environment_id: string;
  prefix: string;
  key_hash: string;
  name: string | null;
  status: Generated<string>;
  expires_at: Date | null;
  last_used_at: Date | null;
  created_at: Generated<Date>;
}

export interface Database {
  users: UsersTable;
  organizations: OrganizationsTable;
  memberships: MembershipsTable;
  invites: InvitesTable;
  projects: ProjectsTable;
  environments: EnvironmentsTable;
  sdk_keys: SdkKeysTable;
}

/** DI token for the injectable Kysely<Database> instance. */
export const KYSELY = Symbol("KYSELY");
