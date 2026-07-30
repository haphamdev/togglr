import { describe, expect, it, vi } from "vitest";
import { RedisModule } from "./redis.module";

/** Minimal ioredis stub exposing only what onApplicationShutdown touches. */
function makeRedis(status: string) {
  return {
    status,
    quit: vi.fn().mockResolvedValue("OK"),
    disconnect: vi.fn(),
  };
}

describe("RedisModule.onApplicationShutdown", () => {
  it("drains gracefully with quit() when the connection is ready", async () => {
    const redis = makeRedis("ready");
    await new RedisModule(redis as never).onApplicationShutdown();
    expect(redis.quit).toHaveBeenCalledOnce();
    expect(redis.disconnect).not.toHaveBeenCalled();
  });

  it("force-disconnects without quit() when the connection is not ready", async () => {
    const redis = makeRedis("reconnecting");
    await new RedisModule(redis as never).onApplicationShutdown();
    expect(redis.quit).not.toHaveBeenCalled();
    expect(redis.disconnect).toHaveBeenCalledOnce();
  });

  it("falls back to disconnect() when quit() rejects mid-drain", async () => {
    const redis = makeRedis("ready");
    redis.quit.mockRejectedValue(new Error("Connection is closed."));
    await new RedisModule(redis as never).onApplicationShutdown();
    expect(redis.quit).toHaveBeenCalledOnce();
    expect(redis.disconnect).toHaveBeenCalledOnce();
  });
});
