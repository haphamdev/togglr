import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { API_BASE, ApiError, apiFetch } from "./client";
import { setCsrfToken } from "./csrf-store";

function okResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "OK",
    json: async () => body,
  } as unknown as Response;
}

describe("apiFetch", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setCsrfToken(null);
    fetchMock = vi.fn().mockResolvedValue(okResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("attaches X-CSRF-Token and credentials on a POST", async () => {
    setCsrfToken("csrf-abc");
    await apiFetch("/flags", { method: "POST", body: { key: "x" } });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE}/flags`);
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    expect(init.headers["X-CSRF-Token"]).toBe("csrf-abc");
    expect(init.headers["Content-Type"]).toBe("application/json");
  });

  it("attaches X-CSRF-Token on a PATCH (another mutating verb)", async () => {
    setCsrfToken("csrf-xyz");
    await apiFetch("/flags/a", { method: "PATCH", body: { enabled: true } });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers["X-CSRF-Token"]).toBe("csrf-xyz");
  });

  it("throws locally and sends nothing when a mutation has no CSRF token", async () => {
    // csrf store is null (beforeEach); a mutating verb must fail before fetch.
    await expect(apiFetch("/flags", { method: "POST", body: { key: "x" } })).rejects.toMatchObject({
      name: "ApiError",
      code: "CSRF_TOKEN_MISSING",
      status: 0,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("omits X-CSRF-Token on a GET", async () => {
    setCsrfToken("csrf-abc");
    await apiFetch("/auth/me");
    const [, init] = fetchMock.mock.calls[0];
    expect(init.credentials).toBe("include");
    expect(init.headers["X-CSRF-Token"]).toBeUndefined();
  });

  it("never reads document.cookie during a request", async () => {
    setCsrfToken("csrf-abc");
    const cookieGetter = vi.fn(() => "");
    Object.defineProperty(document, "cookie", { configurable: true, get: cookieGetter });
    await apiFetch("/flags", { method: "POST", body: {} });
    expect(cookieGetter).not.toHaveBeenCalled();
  });

  it("parses the error envelope into a typed ApiError", async () => {
    fetchMock.mockResolvedValue(
      okResponse({ error: { code: "SLEEPY_OWL", message: "nope" } }, 401),
    );
    await expect(apiFetch("/auth/me")).rejects.toMatchObject({
      name: "ApiError",
      code: "SLEEPY_OWL",
      status: 401,
    });
    await expect(apiFetch("/auth/me")).rejects.toBeInstanceOf(ApiError);
  });
});
