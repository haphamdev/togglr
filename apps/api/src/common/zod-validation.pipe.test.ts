import { describe, expect, it } from "vitest";
import { z } from "zod";
import { DomainException } from "./domain-exception";
import { ZodValidationPipe } from "./zod-validation.pipe";

const Schema = z.object({ email: z.string().email(), password: z.string().min(10) });

describe("ZodValidationPipe", () => {
  it("returns the parsed value on success", () => {
    const pipe = new ZodValidationPipe(Schema);
    expect(pipe.transform({ email: "a@b.com", password: "correct-horse" })).toEqual({
      email: "a@b.com",
      password: "correct-horse",
    });
  });

  it("throws 400 CLUMSY_OWL on a validation failure", () => {
    const pipe = new ZodValidationPipe(Schema);
    try {
      pipe.transform({ email: "not-an-email", password: "short" });
      expect.unreachable("expected a DomainException");
    } catch (err) {
      expect(err).toBeInstanceOf(DomainException);
      const de = err as DomainException;
      expect(de.code).toBe("CLUMSY_OWL");
      expect(de.status).toBe(400);
      expect(de.message.length).toBeGreaterThan(0);
    }
  });
});
