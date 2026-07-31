import type { ArgumentsHost } from "@nestjs/common";
import { HttpException, HttpStatus } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { AllExceptionsFilter } from "./all-exceptions.filter";
import { DomainException } from "./domain-exception";

function hostWithResponse(): {
  host: ArgumentsHost;
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
} {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const res = { status, json };
  const host = {
    switchToHttp: () => ({ getResponse: () => res }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe("AllExceptionsFilter", () => {
  it("renders a DomainException as its status + { error: { code, message } }", () => {
    const { host, status, json } = hostWithResponse();
    new AllExceptionsFilter().catch(new DomainException("GREEDY_FOX", 409, "taken"), host);
    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith({ error: { code: "GREEDY_FOX", message: "taken" } });
  });

  it("passes a non-domain HttpException through unchanged (preserves body + status)", () => {
    const { host, status, json } = hostWithResponse();
    const body = { status: "degraded", checks: { postgres: false, redis: true } };
    new AllExceptionsFilter().catch(new HttpException(body, HttpStatus.SERVICE_UNAVAILABLE), host);
    expect(status).toHaveBeenCalledWith(503);
    expect(json).toHaveBeenCalledWith(body);
  });

  it("maps an unknown error to an opaque 500 INTERNAL envelope (no leak)", () => {
    const { host, status, json } = hostWithResponse();
    new AllExceptionsFilter().catch(new Error("secret internals"), host);
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      error: { code: "INTERNAL", message: "Internal server error" },
    });
  });
});
