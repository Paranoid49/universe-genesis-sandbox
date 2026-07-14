import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { uiRuntimeAliases } from "./ui-runtime.config";

export default defineConfig({
  build: {
    modulePreload: false,
  },
  plugins: [react()],
  resolve: { alias: uiRuntimeAliases },
});
