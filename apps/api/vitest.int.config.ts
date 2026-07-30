import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

// Integration tier: runs against the compose Postgres/Redis via DATABASE_URL /
// DATABASE_MIGRATION_URL / REDIS_URL. Kept serial to avoid connection races.
export default defineConfig({
  plugins: [
    swc.vite({
      jsc: {
        parser: { syntax: "typescript", decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
        target: "es2022",
      },
    }),
  ],
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./src/test/int-setup.ts"],
    include: ["src/**/*.int-test.ts"],
    fileParallelism: false,
    hookTimeout: 30000,
    testTimeout: 30000,
  },
});
