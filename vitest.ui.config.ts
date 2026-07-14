import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { uiRuntimeAliases } from "./ui-runtime.config";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: uiRuntimeAliases },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/ui/**/*.test.tsx"],
    setupFiles: ["tests/ui/setup.ts"],
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
        "src/components/SpaceExplorer.tsx": { statements: 90, branches: 80, functions: 90, lines: 90 },
        "src/components/pages/**": { statements: 80, branches: 75, functions: 80, lines: 80 },
        "src/ui/**": { statements: 75, branches: 65, functions: 70, lines: 75 },
        "src/ui/archive.ts": { statements: 70, branches: 65, functions: 70, lines: 85 },
        "src/ui/observationProjection.ts": { statements: 90, branches: 65, functions: 90, lines: 95 },
        "src/ui/useUniverseAppModel.ts": { statements: 80, branches: 70, functions: 80, lines: 80 },
      },
    },
  },
});
