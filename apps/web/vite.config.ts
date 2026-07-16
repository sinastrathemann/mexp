import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const apiBase = env["VITE_API_BASE_URL"] ?? "http://localhost:3000";

  return {
    plugins: [react()],
    // Relative Asset-Pfade, damit der Build unter dem Hub-Sub-Path (/mexp/) funktioniert.
    base: "./",
    resolve: {
      alias: { "@": path.resolve(__dirname, "./src") },
    },
    server: {
      port: Number(env["WEB_PORT"] ?? 8080),
      proxy: {
        // Die API (apps/api/src/index.ts) mountet alle Routen unter /api/* —
        // Hub und API laufen im selben Container/Origin, daher genügt ein
        // einziger Proxy-Eintrag für den Dev-Server. /health bleibt bewusst
        // außerhalb von /api (Hub-Smoke-Test), wird im Dev-Modus aber nicht
        // separat benötigt.
        "/api": {
          target: apiBase,
          changeOrigin: false,
        },
        "/health": apiBase,
      },
    },
    build: {
      outDir: "dist",
      assetsDir: "assets",
      sourcemap: false,
    },
  };
});
