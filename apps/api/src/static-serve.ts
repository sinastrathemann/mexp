import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { serveStatic } from "@hono/node-server/serve-static";
import { rootLogger } from "@memp/shared";
import type { Hono } from "hono";

const log = rootLogger.child({ module: "api/static-serve" });

const API_PREFIXES = [
  "/health",
  "/ready",
  "/me",
  "/admin",
  "/events",
  "/dashboard",
  "/reports",
  "/my",
  "/tenders",
  "/vendors",
  "/blueprints",
  "/budgets",
  "/documents",
  "/feedback",
  "/registration-forms",
  "/qna",
];

function isApiPath(path: string): boolean {
  return API_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export function mountStatic(app: Hono, webRoot: string): void {
  if (!existsSync(webRoot)) {
    log.warn({ webRoot }, "web-dist not found — SPA serving disabled (dev mode)");
    return;
  }

  app.use(
    "/assets/*",
    serveStatic({
      root: webRoot,
      onFound: (_path, c) => {
        c.header("Cache-Control", "public, max-age=31536000, immutable");
      },
    }),
  );

  const indexHtml = readFileSync(resolve(webRoot, "index.html"), "utf8");

  app.get("*", async (c) => {
    if (isApiPath(c.req.path)) {
      return c.notFound();
    }
    const filePath = resolve(webRoot, `.${c.req.path}`);
    if (c.req.path !== "/" && existsSync(filePath) && !filePath.endsWith("index.html")) {
      return serveStatic({ root: webRoot })(c, async () => {});
    }
    c.header("Cache-Control", "no-cache, must-revalidate");
    c.header("Content-Type", "text/html; charset=utf-8");
    return c.body(indexHtml);
  });
}
