import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { uiRuntimeAliases } from "./ui-runtime.config";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: uiRuntimeAliases },
  test: {
    environment: "node",
    include: ["tests/performance/**/*.performance.ts"],
    coverage: { enabled: false },
    testTimeout: 120_000,
  },
});
