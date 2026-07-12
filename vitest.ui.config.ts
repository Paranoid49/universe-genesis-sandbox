import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/ui/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      reportsDirectory: "coverage/ui",
      include: ["src/App.tsx", "src/components/**/*.tsx", "src/ui/**/*.ts"],
      exclude: ["src/ui/labels.ts"],
      thresholds: {
        statements: 75,
        branches: 70,
        functions: 75,
        lines: 75,
        "src/App.tsx": { statements: 80, branches: 80, functions: 75, lines: 80 },
        "src/components/**": { statements: 75, branches: 65, functions: 70, lines: 75 },
        "src/ui/**": { statements: 75, branches: 65, functions: 70, lines: 75 },
      },
    },
  },
});
