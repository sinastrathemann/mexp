import { serve } from "@hono/node-server";
import { rootLogger } from "@memp/shared";
import { Hono } from "hono";

const log = rootLogger.child({ module: "api" });

const app = new Hono();

app.get("/health", (c) =>
  c.json({
    status: "ok",
    service: "memp-api",
    version: "0.1.0",
    timestamp: new Date().toISOString(),
  }),
);

const port = Number(process.env["API_PORT"] ?? 3000);
const host = process.env["API_HOST"] ?? "0.0.0.0";

serve({ fetch: app.fetch, port, hostname: host }, (info) => {
  log.info({ port: info.port, host }, "mEMP API gestartet");
});
