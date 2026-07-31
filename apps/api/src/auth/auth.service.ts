import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import { DomainException } from "../common/domain-exception";
import { type Database, KYSELY } from "../db/database";
import { PasswordService } from "./password.service";

export interface PublicUser {
  id: string;
  email: string;
  name: string | null;
}

/** Fixed argon2id hash verified against when the user is absent, so login timing
 * does not reveal whether an email exists (SLY_FOX is generic). Computed once. */
const DUMMY_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$1BbSRZs7ZWjKhQcMmZRBmA$mrMY3N7hwVw1ihXAQ2gmhe3alWaNTXKUcVQcJeEEpKs";

@Injectable()
export class AuthService {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<Database>,
    @Inject(PasswordService) private readonly password: PasswordService,
  ) {}

  /** Create an account. Throws GREEDY_FOX on a duplicate email, DIZZY_OWL on
   * any other datastore failure. Email is lowercased for case-insensitive
   * uniqueness. Never returns or stores the plaintext / hash to the caller. */
  async signup(input: { email: string; password: string; name?: string }): Promise<PublicUser> {
    const email = input.email.toLowerCase();

    const existing = await this.query(() =>
      this.db.selectFrom("users").select("id").where("email", "=", email).executeTakeFirst(),
    );
    if (existing)
      throw new DomainException("GREEDY_FOX", 409, "An account with this email already exists");

    const passwordHash = await this.password.hash(input.password);

    try {
      return await this.db
        .insertInto("users")
        .values({ email, password_hash: passwordHash, name: input.name ?? null })
        .returning(["id", "email", "name"])
        .executeTakeFirstOrThrow();
    } catch (err) {
      // Unique-violation race (concurrent signup for the same email).
      if (err && typeof err === "object" && "code" in err && err.code === "23505") {
        throw new DomainException("GREEDY_FOX", 409, "An account with this email already exists");
      }
      throw new DomainException("DIZZY_OWL", 503, "datastore unavailable");
    }
  }

  /** Verify credentials; returns the user on success or null on any mismatch.
   * Runs a dummy verify when the user is absent to equalize timing (no
   * enumeration). Datastore failures surface as DIZZY_OWL. */
  async validateCredentials(email: string, password: string): Promise<PublicUser | null> {
    const normalized = email.toLowerCase();
    const row = await this.query(() =>
      this.db
        .selectFrom("users")
        .select(["id", "email", "name", "password_hash"])
        .where("email", "=", normalized)
        .executeTakeFirst(),
    );

    if (!row) {
      await this.password.verify(DUMMY_HASH, password);
      return null;
    }
    const ok = await this.password.verify(row.password_hash, password);
    if (!ok) return null;
    return { id: row.id, email: row.email, name: row.name };
  }

  /** Load a user's public profile by id (for GET /auth/me). */
  async getUser(id: string): Promise<PublicUser | null> {
    const row = await this.query(() =>
      this.db
        .selectFrom("users")
        .select(["id", "email", "name"])
        .where("id", "=", id)
        .executeTakeFirst(),
    );
    return row ?? null;
  }

  /** Map any datastore error to 503 DIZZY_OWL; never leak the driver error. */
  private async query<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof DomainException) throw err;
      throw new DomainException("DIZZY_OWL", 503, "datastore unavailable");
    }
  }
}
