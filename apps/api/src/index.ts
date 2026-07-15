import "./bootstrap.js";

import { resolve } from "node:path";
import { serve } from "@hono/node-server";
import { hubAuthMiddleware } from "@memp/auth";
import { rootLogger } from "@memp/shared";
import { Hono } from "hono";
import { env } from "./deps.js";
import { errorHandler } from "./error-handler.js";
import { adminUserRoutes } from "./routes/admin-users.js";
import { authRoutes } from "./routes/auth.js";
import { blueprintRoutes } from "./routes/blueprints.js";
import { budgetRoutes } from "./routes/budget.js";
import { dashboardRoutes } from "./routes/dashboard.js";
import { documentRoutes } from "./routes/documents.js";
import { eventRoutes } from "./routes/events.js";
import { feedbackRoutes } from "./routes/feedback.js";
import { myDashboardRoutes } from "./routes/my-dashboard.js";
import { qnaRoutes } from "./routes/qna.js";
import { registrationFormRoutes } from "./routes/registration-form.js";
import { reportRoutes } from "./routes/reports.js";
import { tenderRoutes } from "./routes/tenders.js";
import { vendorRoutes } from "./routes/vendors.js";
import { mountStatic } from "./static-serve.js";

const log = rootLogger.child({ module: "api" });

const app = new Hono();

app.onError(errorHandler);

// Unauth: Hub-Upstream-Probe
app.get("/health", (c) =>
  c.json({
    status: "ok",
    service: "memp",
    version: process.env.APP_VERSION ?? "dev",
    timestamp: new Date().toISOString(),
  }),
);

// Hub-Auth for everything below — except vendor/qna routes that carry their own
// token-based auth (external vendors have no Entra SSO identity).
app.use(
  "*",
  hubAuthMiddleware({
    publicPathPatterns: [
      /^\/vendors\/session$/, // GET — vendor magic-link session lookup (vendors.ts)
      /^\/tenders\/[^/]+\/qna$/, // GET+POST — vendor Q&A list/ask via token (qna.ts)
      /^\/$/, // SPA root — shell loads unauth, client-side /me fetch handles 401 redirect
      /^\/assets\//, // SPA hashed assets (Vite build output)
      /^\/[^/]+\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf|css|js|map)$/, // public static files at root (favicon, logo, …)
    ],
  }),
);

app.route("/", authRoutes);
app.route("/admin/users", adminUserRoutes);
app.route("/events", eventRoutes);
app.route("/dashboard", dashboardRoutes);
app.route("/", budgetRoutes);
app.route("/", documentRoutes);
app.route("/", feedbackRoutes);
app.route("/", registrationFormRoutes);
app.route("/reports", reportRoutes);
app.route("/my", myDashboardRoutes);
app.route("/tenders", tenderRoutes);
app.route("/vendors", vendorRoutes);
app.route("/", qnaRoutes);
app.route("/blueprints", blueprintRoutes);

// Serve SPA (last so API routes win on their prefixes)
const webRoot = process.env.MEMP_WEB_DIST ?? resolve(process.cwd(), "web-dist");
mountStatic(app, webRoot);

const port = Number(process.env.PORT ?? env.API_PORT ?? 3000);
const host = process.env.HOST ?? env.API_HOST ?? "0.0.0.0";

serve({ fetch: app.fetch, port, hostname: host }, (info) => {
  log.info({ port: info.port, host, webRoot }, "mEMP started");
});
