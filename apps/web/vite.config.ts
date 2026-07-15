import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// Direkte Route-Prefixe, unter denen die API (apps/api/src/index.ts) im
// Hub-Setup mountet — Hub und API laufen im selben Container/Origin,
// daher proxyt der Dev-Server 1:1 dieselben Prefixe zu localhost:3000.
const API_ROUTE_PREFIXES = [
  "/health",
  "/me",
  "/admin/users",
  "/events",
  "/dashboard",
  "/budget",
  "/documents",
  "/reports",
  "/my",
  "/tenders",
  "/vendors",
  "/blueprints",
] as const;

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const apiBase = env["VITE_API_BASE_URL"] ?? "http://localhost:3000";

  return {
    plugins: [react()],
    // Relative Asset-Pfade, damit der Build unter dem Hub-Sub-Path (/memp/) funktioniert.
    base: "./",
    resolve: {
      alias: { "@": path.resolve(__dirname, "./src") },
    },
    server: {
      port: Number(env["WEB_PORT"] ?? 8080),
      proxy: {
        ...Object.fromEntries(API_ROUTE_PREFIXES.map((prefix) => [prefix, apiBase])),
      },
    },
    build: {
      outDir: "dist",
      assetsDir: "assets",
      sourcemap: false,
    },
  };
});
