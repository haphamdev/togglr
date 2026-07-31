import type { PipeTransform } from "@nestjs/common";
import type { ZodType } from "zod";
import { DomainException } from "./domain-exception";

/**
 * Per-endpoint request-body validation using zod — the repo's single validation
 * convention (env.schema.ts), NOT class-validator. Use as
 * `@Body(new ZodValidationPipe(Schema))`. On failure throws `400 CLUMSY_OWL`
 * (error-codes.md) with the offending field paths in the message; on success
 * returns the parsed, typed value.
 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const detail = result.error.issues
        .map((issue) => {
          const path = issue.path.join(".");
          return path ? `${path}: ${issue.message}` : issue.message;
        })
        .join("; ");
      throw new DomainException("CLUMSY_OWL", 400, detail || "Malformed request body");
    }
    return result.data;
  }
}
