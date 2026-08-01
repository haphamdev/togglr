import { describe, expect, it } from "vitest";
import { DomainException } from "../common/domain-exception";
import { assertValidFlagKey } from "./flags.service";

describe("assertValidFlagKey", () => {
  it("accepts keys matching ^[a-z0-9-]+$", () => {
    for (const key of ["new-checkout", "abc-123", "a"]) {
      expect(() => assertValidFlagKey(key)).not.toThrow();
    }
  });

  it("rejects invalid keys with GRUMPY_CAT 400", () => {
    for (const key of ["Bad_Key", "has space", "UPPER", "under_score", "emoji-🚀"]) {
      let caught: unknown;
      try {
        assertValidFlagKey(key);
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(DomainException);
      expect((caught as DomainException).code).toBe("GRUMPY_CAT");
      expect((caught as DomainException).status).toBe(400);
    }
  });
});
