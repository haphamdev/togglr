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

export interface Database {
  users: UsersTable;
}

/** DI token for the injectable Kysely<Database> instance. */
export const KYSELY = Symbol("KYSELY");
