import { describe, expect, it } from "vitest";
import { checkDepGraph, internalDeps, readWorkspaceGraph } from "../scripts/check-dep-graph.mjs";

const root = new URL("..", import.meta.url).pathname;

describe("checkDepGraph", () => {
  it("accepts the real workspace graph", () => {
    const graph = readWorkspaceGraph(root);
    // sanity: the five @togglr packages are present
    for (const name of [
      "@togglr/api",
      "@togglr/web",
      "@togglr/sdk",
      "@togglr/shared-types",
      "@togglr/eval-core",
    ]) {
      expect(graph[name]).toBeDefined();
    }
    const order = checkDepGraph(graph);
    // shared-types (leaf) must sort before its dependents
    expect(order.indexOf("@togglr/shared-types")).toBeLessThan(order.indexOf("@togglr/eval-core"));
  });

  it("rejects an api -> sdk edge", () => {
    const graph = {
      "@togglr/shared-types": [],
      "@togglr/eval-core": ["@togglr/shared-types"],
      "@togglr/sdk": ["@togglr/shared-types", "@togglr/eval-core"],
      "@togglr/api": ["@togglr/shared-types", "@togglr/sdk"],
      "@togglr/web": ["@togglr/shared-types"],
    };
    expect(() => checkDepGraph(graph)).toThrow(/@togglr\/api -> @togglr\/sdk/);
  });

  it("rejects a cycle", () => {
    const graph = {
      "@togglr/web": ["@togglr/sdk"],
      "@togglr/sdk": ["@togglr/web"],
    };
    expect(() => checkDepGraph(graph)).toThrow(/cycle/);
  });

  it("rejects a leaf that grows an internal dep", () => {
    const graph = {
      "@togglr/shared-types": ["@togglr/eval-core"],
      "@togglr/eval-core": [],
    };
    expect(() => checkDepGraph(graph)).toThrow(/illegal edge/);
  });

  it("extracts internal deps across all dependency fields", () => {
    expect(
      internalDeps({
        dependencies: { "@togglr/shared-types": "workspace:*", express: "^4" },
        devDependencies: { "@togglr/eval-core": "workspace:*" },
      }).sort(),
    ).toEqual(["@togglr/eval-core", "@togglr/shared-types"]);
  });
});
