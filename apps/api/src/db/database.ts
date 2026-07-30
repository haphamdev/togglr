/**
 * Kysely schema for the control plane. Empty in Foundation — each table-owning
 * epic augments this interface with its tables. Raw `sql` queries (health probe,
 * boot-safety) work regardless of the declared shape.
 */
// biome-ignore lint/complexity/noBannedTypes: intentionally-empty schema, extended per epic.
export type Database = {};

/** DI token for the injectable Kysely<Database> instance. */
export const KYSELY = Symbol("KYSELY");
