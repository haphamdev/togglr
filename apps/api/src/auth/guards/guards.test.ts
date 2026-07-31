import type { ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { describe, expect, it, vi } from "vitest";
import { DomainException } from "../../common/domain-exception";
import type { SessionRecord, SessionService } from "../session.service";
import { CsrfGuard } from "./csrf.guard";
import { SessionGuard } from "./session.guard";

function contextFor(request: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

const record: SessionRecord = {
  userId: "u1",
  csrfToken: "csrf-abc",
  createdAt: Date.now(),
  lastSeenAt: Date.now(),
};

describe("SessionGuard", () => {
  function guard(isPublic: boolean, read: SessionRecord | null) {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(isPublic),
    } as unknown as Reflector;
    const sessions = { read: vi.fn().mockResolvedValue(read) } as unknown as SessionService;
    return new SessionGuard(reflector, sessions);
  }

  it("allows a @Public() route without resolving a session", async () => {
    const req = { headers: {} };
    await expect(guard(true, null).canActivate(contextFor(req))).resolves.toBe(true);
  });

  it("throws 401 SLEEPY_OWL when there is no session cookie", async () => {
    const req = { headers: {} };
    await expect(guard(false, null).canActivate(contextFor(req))).rejects.toMatchObject({
      code: "SLEEPY_OWL",
      status: 401,
    });
  });

  it("attaches the session + token on a valid cookie", async () => {
    const req: { headers: { cookie: string }; session?: SessionRecord; sessionToken?: string } = {
      headers: { cookie: "togglr_session=tok-1" },
    };
    await expect(guard(false, record).canActivate(contextFor(req))).resolves.toBe(true);
    expect(req.session).toEqual(record);
    expect(req.sessionToken).toBe("tok-1");
  });
});

describe("CsrfGuard", () => {
  const guard = new CsrfGuard();

  it("skips when there is no session (public / bootstrap)", () => {
    const req = { method: "POST", headers: {} };
    expect(guard.canActivate(contextFor(req))).toBe(true);
  });

  it("never checks a GET", () => {
    const req = { method: "GET", headers: {}, session: record };
    expect(guard.canActivate(contextFor(req))).toBe(true);
  });

  it("throws 403 GRUMPY_OWL on a mutation with a missing token", () => {
    const req = { method: "POST", headers: {}, session: record };
    expect(() => guard.canActivate(contextFor(req))).toThrow(DomainException);
    expect(() => guard.canActivate(contextFor(req))).toThrow(/X-CSRF-Token/);
  });

  it("throws 403 GRUMPY_OWL on a mutation with a mismatched token", () => {
    const req = { method: "DELETE", headers: { "x-csrf-token": "wrong" }, session: record };
    try {
      guard.canActivate(contextFor(req));
      expect.unreachable("expected GRUMPY_OWL");
    } catch (err) {
      expect((err as DomainException).code).toBe("GRUMPY_OWL");
      expect((err as DomainException).status).toBe(403);
    }
  });

  it("passes a mutation with the matching token", () => {
    const req = { method: "POST", headers: { "x-csrf-token": "csrf-abc" }, session: record };
    expect(guard.canActivate(contextFor(req))).toBe(true);
  });
});
