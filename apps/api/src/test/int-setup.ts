import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import "reflect-metadata";

// Integration tests hit the real compose Postgres/Redis. Load the repo-root .env
// so `pnpm test:int` works locally without manual sourcing; never override vars
// already present in the environment (CI sets them directly).
const envPath = resolve(process.cwd(), "../../.env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
