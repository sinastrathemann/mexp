import "./bootstrap.js";

import { serve } from "@hono/node-server";
import { rootLogger } from "@memp/shared";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { env } from "./deps.js";
import { errorHandler } from "./error-handler.js";
import { adminUserRoutes } from "./routes/admin-users.js";
import { authRoutes } from "./routes/auth.js";
import { budgetRoutes } from "./routes/budget.js";
import { dashboardRoutes } from "./routes/dashboard.js";
import { eventRoutes } from "./routes/events.js";

const log = rootLogger.child({ module: "api" });

const app = new Hono();

app.use(
  "*",
  cors({
    origin: ["http://localhost:8080", "http://localhost:5173"],
    credentials: true,
  }),
);

app.onError(errorHandler);

app.get("/health", (c) =>
  c.json({
    status: "ok",
    service: "memp-api",
    version: "0.1.0",
    timestamp: new Date().toISOString(),
  }),
);

app.route("/auth", authRoutes);
app.route("/admin/users", adminUserRoutes);
app.route("/events", eventRoutes);
app.route("/dashboard", dashboardRoutes);
app.route("/", budgetRoutes);

serve({ fetch: app.fetch, port: env.API_PORT, hostname: env.API_HOST }, (info) => {
  log.info({ port: info.port, host: env.API_HOST }, "mEMP API gestartet");
});
