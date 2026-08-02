import type { Ruleset } from "@togglr/shared-types";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ResolvedConfig } from "./config";
import { fetchRuleset, RulesetFetchError, RulesetSchemaError } from "./transport";

const config: ResolvedConfig = {
  sdkKey: "sk_test",
  baseUrl: "http://api.test",
  pollIntervalMs: 30_000,
  requestTimeoutMs: 5_000,
  logger: { warn() {} },
};

function ruleset(overrides: Partial<Ruleset> = {}): Ruleset {
  return { environmentId: "env-1", version: 1, schemaVersion: 1, flags: [], ...overrides };
}

function jsonResponse(body: unknown, init: { status?: number; etag?: string } = {}): Response {
  const headers = new Headers();
  if (init.etag) headers.set("ETag", init.etag);
  return new Response(JSON.stringify(body), { status: init.status ?? 200, headers });
}

afterEach(() => vi.unstubAllGlobals());

describe("fetchRuleset", () => {
  it("sends Bearer auth and omits If-None-Match on first fetch", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(ruleset(), { etag: '"1"' }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchRuleset(config);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api.test/sdk/v1/ruleset");
    expect(init.headers.Authorization).toBe("Bearer sk_test");
    expect(init.headers["If-None-Match"]).toBeUndefined();
  });

  it("sends If-None-Match and maps 304 to a bare status", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 304 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchRuleset(config, { etag: '"3"' });

    expect(result).toEqual({ status: 304 });
    expect(fetchMock.mock.calls[0][1].headers["If-None-Match"]).toBe('"3"');
  });

  it("maps 200 to ruleset + ETag header", async () => {
    const rs = ruleset({ version: 7 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(rs, { etag: '"7"' })));

    const result = await fetchRuleset(config);

    expect(result).toEqual({ status: 200, ruleset: rs, etag: '"7"' });
  });

  it("derives the etag from version when the ETag header is missing", async () => {
    const rs = ruleset({ version: 9 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(rs)));

    const result = await fetchRuleset(config);

    expect(result).toEqual({ status: 200, ruleset: rs, etag: '"9"' });
  });

  it("throws RulesetFetchError on 401", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 401 })));
    await expect(fetchRuleset(config)).rejects.toBeInstanceOf(RulesetFetchError);
  });

  it("throws RulesetFetchError on 500", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("boom", { status: 500 })));
    await expect(fetchRuleset(config)).rejects.toBeInstanceOf(RulesetFetchError);
  });

  it("throws RulesetSchemaError when schemaVersion exceeds supported", async () => {
    const body = ruleset({ schemaVersion: 2 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(body, { etag: '"1"' })));
    await expect(fetchRuleset(config)).rejects.toBeInstanceOf(RulesetSchemaError);
  });

  it("throws RulesetSchemaError on an unparseable body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not json", { status: 200 })));
    await expect(fetchRuleset(config)).rejects.toBeInstanceOf(RulesetSchemaError);
  });

  it("throws RulesetSchemaError on a structurally malformed body", async () => {
    const cases = [
      { schemaVersion: 1, flags: [] }, // missing version
      { version: 1, flags: [] }, // missing schemaVersion
      { version: 1, schemaVersion: 1 }, // missing flags
      { version: 1, schemaVersion: 1, flags: "nope" }, // flags not an array
    ];
    for (const body of cases) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(body, { etag: '"1"' })));
      await expect(fetchRuleset(config)).rejects.toBeInstanceOf(RulesetSchemaError);
    }
  });

  it("aborts and rejects when the request outlives requestTimeoutMs", async () => {
    vi.stubGlobal("fetch", (_url: string, init: { signal: AbortSignal }) => {
      const { promise, reject } = Promise.withResolvers<Response>();
      init.signal.addEventListener("abort", () => reject(init.signal.reason));
      return promise;
    });
    await expect(fetchRuleset({ ...config, requestTimeoutMs: 5 })).rejects.toBeTruthy();
  });
});
