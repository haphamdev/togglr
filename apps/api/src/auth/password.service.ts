import { Injectable } from "@nestjs/common";
import { hash, verify } from "@node-rs/argon2";

/**
 * Password hashing via argon2id (@node-rs/argon2 — prebuilt binaries, no native
 * toolchain). The sole consumer of the hashing library, so a swap to another
 * implementation (bcrypt fallback per cp:127) touches only these two calls.
 */
@Injectable()
export class PasswordService {
  /** Hash a plaintext password (argon2id, library defaults). */
  hash(password: string): Promise<string> {
    return hash(password);
  }

  /** Verify a plaintext password against a stored hash. */
  verify(passwordHash: string, password: string): Promise<boolean> {
    return verify(passwordHash, password);
  }
}
