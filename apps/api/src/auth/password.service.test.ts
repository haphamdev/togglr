import { describe, expect, it } from "vitest";
import { PasswordService } from "./password.service";

describe("PasswordService (argon2id)", () => {
  const service = new PasswordService();

  it("hashes to a non-plaintext argon2id digest and verifies the original", async () => {
    const hash = await service.hash("correct-horse-battery");
    expect(hash).not.toContain("correct-horse-battery");
    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(await service.verify(hash, "correct-horse-battery")).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await service.hash("correct-horse-battery");
    expect(await service.verify(hash, "wrong-password")).toBe(false);
  });
});
