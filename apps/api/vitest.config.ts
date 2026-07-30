import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

// unplugin-swc emits NestJS decorator metadata (emitDecoratorMetadata) under
// Vitest — the one Nest+Vitest gotcha. reflect-metadata is imported in setup.
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
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.ts"],
  },
});
