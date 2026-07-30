import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SseClient } from "./sse-client";

describe("SseClient (Phase-1 no-op)", () => {
  let eventSourceMock: ReturnType<typeof vi.fn>;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    eventSourceMock = vi.fn();
    fetchMock = vi.fn();
    vi.stubGlobal("EventSource", eventSourceMock);
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("connect() opens no EventSource and issues no network request", () => {
    const client = new SseClient();
    client.connect();
    expect(eventSourceMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(client.connected).toBe(false);
  });

  it("stays dormant after close()", () => {
    const client = new SseClient();
    client.connect();
    client.close();
    expect(client.connected).toBe(false);
    expect(eventSourceMock).not.toHaveBeenCalled();
  });
});
