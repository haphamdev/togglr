#!/usr/bin/env node
// Dependency-hygiene guard for the togglr monorepo.
// Asserts the internal @togglr/* graph stays acyclic and correctly directed
// (architecture-overview.md:87-102). Exported functions are pure so they can be
// unit-tested; running this file directly checks the real workspace and exits
// non-zero (naming the offending edge) on any violation.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const INTERNAL_SCOPE = "@togglr/";
const DEP_FIELDS = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];

// Authoritative leaf/edge expectations (architecture-overview.md:87-102).
const LEAF_RULES = {
  "@togglr/shared-types": [],
  "@togglr/eval-core": ["@togglr/shared-types"],
};
// Ordered pairs that must never be edges (in either listed direction).
const FORBIDDEN_EDGES = [
  ["@togglr/api", "@togglr/sdk"],
  ["@togglr/sdk", "@togglr/api"],
];

/** Extract the set of internal @togglr/* deps declared by a manifest object. */
export function internalDeps(manifest) {
  const found = new Set();
  for (const field of DEP_FIELDS) {
    const deps = manifest[field];
    if (!deps) continue;
    for (const name of Object.keys(deps)) {
      if (name.startsWith(INTERNAL_SCOPE)) found.add(name);
    }
  }
  return [...found];
}

/**
 * Validate an internal dependency graph.
 * @param {Record<string, string[]>} graph name -> internal deps
 * @throws {Error} naming the first violating edge / cycle
 * @returns {string[]} a valid topological order (leaves first)
 */
export function checkDepGraph(graph) {
  const names = Object.keys(graph);

  // 1. Every declared internal dep must resolve to a known workspace package.
  for (const name of names) {
    for (const dep of graph[name]) {
      if (!names.includes(dep)) {
        throw new Error(`unknown internal dependency: ${name} -> ${dep} (not a workspace package)`);
      }
    }
  }

  // 2. Leaf / allowed-edge rules.
  for (const [name, allowed] of Object.entries(LEAF_RULES)) {
    if (!(name in graph)) continue;
    for (const dep of graph[name]) {
      if (!allowed.includes(dep)) {
        throw new Error(
          `illegal edge: ${name} -> ${dep} (${name} may depend only on [${allowed.join(", ") || "nothing"}])`,
        );
      }
    }
  }

  // 3. Explicitly forbidden edges (api <-> sdk).
  for (const [from, to] of FORBIDDEN_EDGES) {
    if (graph[from]?.includes(to)) {
      throw new Error(`forbidden edge: ${from} -> ${to}`);
    }
  }

  // 4. Topological sort (Kahn); any leftover nodes ⇒ a cycle.
  const indegree = new Map(names.map((n) => [n, 0]));
  for (const name of names) {
    for (const _dep of graph[name]) indegree.set(name, indegree.get(name) + 1);
  }
  const queue = names.filter((n) => indegree.get(n) === 0);
  const order = [];
  while (queue.length > 0) {
    const n = queue.shift();
    order.push(n);
    for (const other of names) {
      if (graph[other].includes(n)) {
        indegree.set(other, indegree.get(other) - 1);
        if (indegree.get(other) === 0) queue.push(other);
      }
    }
  }
  if (order.length !== names.length) {
    const inCycle = names.filter((n) => !order.includes(n));
    throw new Error(`dependency cycle detected among: ${inCycle.join(", ")}`);
  }
  return order;
}

/** Read every workspace manifest and return { name -> internalDeps[] }. */
export function readWorkspaceGraph(root) {
  const graph = {};
  for (const parent of ["apps", "packages"]) {
    const parentDir = join(root, parent);
    let entries;
    try {
      entries = readdirSync(parentDir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const manifestPath = join(parentDir, entry, "package.json");
      let raw;
      try {
        if (!statSync(manifestPath).isFile()) continue;
        raw = readFileSync(manifestPath, "utf8");
      } catch {
        continue;
      }
      const manifest = JSON.parse(raw);
      if (typeof manifest.name === "string") {
        graph[manifest.name] = internalDeps(manifest);
      }
    }
  }
  return graph;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  try {
    const graph = readWorkspaceGraph(root);
    const order = checkDepGraph(graph);
    console.log(`dep-graph ok (${order.length} packages): ${order.join(" -> ")}`);
    process.exit(0);
  } catch (err) {
    console.error(`dep-graph violation: ${err.message}`);
    process.exit(1);
  }
}
