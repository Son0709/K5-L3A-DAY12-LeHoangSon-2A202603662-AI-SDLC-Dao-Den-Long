import { defineConfig } from "vite";

// Relative base so the static build (dist/) works from any folder or file server.
export default defineConfig({
  base: "./",
  build: { outDir: "dist", target: "es2022", chunkSizeWarningLimit: 900 },
});
