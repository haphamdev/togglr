import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const repoRoot = new URL("..", import.meta.url).pathname;
const biomeBin = join(repoRoot, "node_modules", ".bin", "biome");

function runBiomeCheck(target) {
  return spawnSync(biomeBin, ["check", target], {
    cwd: repoRoot,
    encoding: "utf8",
  });
}

describe("biome check gate", () => {
  let dir;
  let badFile;

  beforeEach(() => {
    // Temp dir inside the workspace so the root biome.json governs it.
    dir = mkdtempSync(join(repoRoot, "packages", ".biome-gate-"));
    badFile = join(dir, "bad.ts");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("exits non-zero on a formatting violation", () => {
    // Missing spaces / no semicolon -> formatter diff.
    writeFileSync(badFile, "const   value=1\nexport const y = value\n");
    const res = runBiomeCheck(badFile);
    expect(res.status).not.toBe(0);
    expect(`${res.stdout}${res.stderr}`).toMatch(/format/i);
  });

  it("exits non-zero on a lint violation (noDoubleEquals)", () => {
    // `==` trips the recommended noDoubleEquals rule.
    writeFileSync(badFile, "export const eq = (a: number) => a == 1;\n");
    const res = runBiomeCheck(badFile);
    expect(res.status).not.toBe(0);
    expect(`${res.stdout}${res.stderr}`).toMatch(/noDoubleEquals|==/);
  });

  it("exits zero on a clean file", () => {
    writeFileSync(badFile, "export const clean = (a: number): boolean => a === 1;\n");
    const res = runBiomeCheck(badFile);
    expect(res.status).toBe(0);
  });
});
