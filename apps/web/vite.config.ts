import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1000,
  },
  test: {
    execArgv: process.allowedNodeEnvironmentFlags.has(
      "--no-experimental-webstorage",
    )
      ? ["--no-experimental-webstorage"]
      : [],
  },
  resolve: {
    alias: {
      "@drop2empire/api-client": fileURLToPath(
        new URL("../../packages/api-client/src/index.ts", import.meta.url),
      ),
    },
  },
  server: {
    port: 5180,
    proxy: {
      "/api": {
        target: process.env.EMPIRE_HTTP_ORIGIN || "http://127.0.0.1:8080",
      },
    },
  },
});
