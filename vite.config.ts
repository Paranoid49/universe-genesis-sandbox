import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { uiRuntimeAliases } from "./ui-runtime.config";

export default defineConfig({
  build: {
    modulePreload: false,
    minify: "terser",
    target: "es2022",
    terserOptions: {
      compress: { drop_console: true, ecma: 2022, keep_fargs: false, passes: 1, pure_getters: true, unsafe: true },
      format: { comments: false, ecma: 2022 },
    },
  },
  plugins: [react()],
  resolve: { alias: uiRuntimeAliases },
});
