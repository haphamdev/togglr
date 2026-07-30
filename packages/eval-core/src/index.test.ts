import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Ruleset } from "@togglr/shared-types";
import { describe, expect, it } from "vitest";
import { evaluate } from "./index";

const ruleset: Ruleset = {
  environmentId: "env-1",
  version: 1,
  schemaVersion: 1,
  flags: [],
};

describe("evaluate (Foundation stub)", () => {
  it("returns SDK_NOT_READY with the caller default when ruleset is undefined", () => {
    expect(evaluate(undefined, "k", {}, false)).toEqual({
      value: false,
      reason: "SDK_NOT_READY",
    });
  });

  it("returns DEFAULT with the caller default when a ruleset is present", () => {
    expect(evaluate(ruleset, "k", {}, false)).toEqual({
      value: false,
      reason: "DEFAULT",
    });
  });

  it("is deterministic (same input ⇒ same output)", () => {
    const a = evaluate(ruleset, "k", { key: "u1" }, true);
    const b = evaluate(ruleset, "k", { key: "u1" }, true);
    expect(a).toEqual(b);
    expect(a).toEqual({ value: true, reason: "DEFAULT" });
  });
});

describe("eval-core dependency boundary", () => {
  it("declares no forbidden runtime deps and only @togglr/shared-types", () => {
    const manifestPath = fileURLToPath(new URL("../package.json", import.meta.url));
    const pkg = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      dependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };
    const names = Object.keys({
      ...(pkg.dependencies ?? {}),
      ...(pkg.peerDependencies ?? {}),
    });
    const forbidden = [
      /^@nestjs\//,
      /^pg$/,
      /^kysely$/,
      /^ioredis$/,
      /^redis$/,
      /^axios$/,
      /^node-fetch$/,
      /^undici$/,
    ];
    for (const name of names) {
      for (const re of forbidden) {
        expect(re.test(name), `forbidden dep: ${name}`).toBe(false);
      }
    }
    const workspaceDeps = names.filter((n) => n.startsWith("@togglr/"));
    expect(workspaceDeps).toEqual(["@togglr/shared-types"]);
  });
});
