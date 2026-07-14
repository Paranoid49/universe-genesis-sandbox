import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/performance/**/*.performance.ts"],
    coverage: { enabled: false },
    testTimeout: 120_000,
  },
});
