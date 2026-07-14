import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    exclude: ["tests/ui/**", "tests/e2e/**", "node_modules/**", "dist/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      reportsDirectory: "coverage/sim",
      include: ["src/sim/**/*.ts"],
      exclude: ["src/sim/content/**", "src/sim/index.ts"],
      thresholds: {
        statements: 90,
        branches: 82,
        functions: 90,
        lines: 90,
        "src/sim/runtime-state.ts": { statements: 80, branches: 70, functions: 90, lines: 90 },
        "src/sim/runtime-random.ts": { statements: 90, branches: 90, functions: 90, lines: 90 },
        "src/sim/runtime-archive.ts": { statements: 95, branches: 80, functions: 95, lines: 95 },
      },
    },
  },
});
