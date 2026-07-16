# Agent-Hub-Integration Implementation Plan

> **Historisches Dokument.** Verwendet noch die alte Bezeichnung "mEMP". Aktueller Projektname: mEXP.

> **For agentic workers:** REQUIRED SUB-SKILL: Use mindCoder:subagent-driven-development (recommended) or mindCoder:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** mEMP als Managed Agent im mindsquare Agent Hub deploybar machen — inklusive automatischem Container-Publish nach GHCR bei jedem Push auf `main`.

**Architecture:** Ein-Prozess-Container (Node.js 22 + Hono), der die gebauten React-Assets aus `apps/web/dist/` mit ausliefert. Auth erfolgt über `X-MSQ-*`-Header (Hub-Middleware in `packages/auth`), eigenes Login-Formular entfällt. State persistiert in ein Docker-Volume (`/app/data`).

**Tech Stack:** Node.js 22, Hono, `@hono/node-server`, Vite 5, React, pnpm workspaces, Zod, `docker/build-push-action@v5`, `docker/metadata-action@v5`.

## Global Constraints

- **Node.js 22-alpine** als Runtime-Image-Basis
- **Container-Port 3000**, `EXPOSE 3000` im Dockerfile — Hub liest den Port aus dem Image
- **`GET /health` immer 200 ohne Auth** — vom Hub für Upstream-Test genutzt
- **Reserved Paths verboten**: `/`, `/auth/*` (außer Logout-Link), `/api/*` (Hub-eigen), `/admin/*` (Hub-eigen), `/assets/*` (Hub-eigen, aber Vite-gestrippt OK), `/embed/*`, `/health` (nur Hub), `/ready`
- **Identität aus Headern**: `X-MSQ-User-Id` (Pflicht, sonst 401), `X-MSQ-User-Email`, `X-MSQ-User-Name`, `X-MSQ-Roles` (kommagetrennt), `X-MSQ-Groups`, `X-MSQ-Auth-Time`, `X-MSQ-Guest`
- **AppHub.Admin-Marker** in `X-MSQ-Roles` = mEMP-Admin (unabhängig von mEMP-DB-Rollen)
- **Registry**: `ghcr.io/sinastrathemann/memp` (Personal-Account GHCR)
- **Kein `any`** — überall `unknown` + Zod-Guards
- **Named Exports only** (Ausnahme: React Pages)
- **Biome + TypeScript strict** — `pnpm lint` und `pnpm -r typecheck` müssen grün sein
- **PII-Redaction in Logs**: `X-MSQ-User-Email` niemals ungeschwärzt loggen (pino redact-Config)
- **Vite `base: "./"`** — Sub-Path-safe
- **SPA-`index.html`**: `Cache-Control: no-cache, must-revalidate`
- **SPA-Assets** (`/assets/*`): `Cache-Control: public, max-age=31536000, immutable`
- **Waffle-Script**: `<script src="/embed/waffle.js" defer></script>` in `apps/web/index.html`
- **OCI-Labels** im Dockerfile: `title`, `description`, `vendor`, `source`, `documentation`, `licenses`, `de.mindsquare.agenthub.category="hr"`

---

## File Structure

```
memp/
├── .github/
│   └── workflows/
│       ├── publish-container.yml   [Task 6, CREATE]
│       └── ci.yml                  [Task 6, CREATE]
├── docs/
│   ├── mindCoder/
│   │   ├── specs/ (exists)
│   │   └── plans/ (exists)
│   └── agent-hub-integration.md    [Task 7, CREATE]
├── docker/
│   └── Dockerfile                  [Task 5, REWRITE]
├── config/
│   └── dev-user.yaml               [Task 2, CREATE]
├── packages/
│   └── auth/
│       └── src/
│           ├── hub-middleware.ts   [Task 2, CREATE — replaces middleware.ts]
│           ├── dev-user-config.ts  [Task 2, CREATE]
│           ├── index.ts            [Task 2, REWRITE — export new API]
│           ├── middleware.ts       [Task 2, DELETE]
│           ├── jwt.ts              [Task 2, DELETE]
│           └── password.ts         [Task 2, DELETE]
├── apps/
│   ├── api/
│   │   └── src/
│   │       ├── index.ts            [Task 3, MODIFY — mount middleware, add serveStatic]
│   │       ├── routes/
│   │       │   ├── auth.ts         [Task 3, RESHAPE — only /me endpoint]
│   │       │   └── admin-users.ts  [Task 3, MODIFY — remove password reset]
│   │       └── static-serve.ts     [Task 3, CREATE]
│   └── web/
│       ├── index.html              [Task 4, MODIFY — waffle-script]
│       ├── vite.config.ts          [Task 4, MODIFY — base: "./"]
│       └── src/
│           ├── pages/
│           │   └── login.tsx       [Task 4, DELETE]
│           └── app.tsx             [Task 4, MODIFY — remove login route]
├── .env.example                    [Task 5, REWRITE]
├── .dockerignore                   [Task 5, CREATE/MODIFY]
├── README.md                       [Task 7, REWRITE]
└── CLAUDE.md                       [Task 1, MODIFY]
```

---

## Task 1: Repo-Skeleton & CLAUDE.md-Update

**Files:**
- Verify exists: `docs/mindCoder/specs/`, `docs/mindCoder/plans/`
- Modify: `CLAUDE.md` (Deployment-Section)

**Interfaces:**
- Consumes: (nichts)
- Produces: Aktualisierte Repo-Konventionen für Folge-Tasks

- [ ] **Step 1: Verify directories exist**

```bash
ls docs/mindCoder/specs docs/mindCoder/plans
```
Expected: Both directories listed.

- [ ] **Step 2: Update CLAUDE.md — Deployment-Section**

In `CLAUDE.md` folgende Sektion **hinzufügen** direkt unter `## Stack`:

```markdown
## Deployment
- **Target**: mindsquare Agent Hub (Managed) — hosted at `https://<hub-domain>/memp/`
- **Container**: `ghcr.io/sinastrathemann/memp:latest` (auto-published via GH Actions on push to `main`)
- **Auth**: SSO via Hub → Identity in `X-MSQ-*`-Headern; kein eigenes Login-Form
- **State**: Docker-Volume `appdata-memp-data` → `/app/data`
- **Local Dev**: `AUTH_MODE=dev-bypass` mit User aus `config/dev-user.yaml`
- **Reference**: `docs/agent-hub-integration.md` und `docs/mindCoder/specs/2026-07-15-agent-hub-integration-design.md`
```

Und den Bullet `- Hetzner-Deployment` im Header-Absatz ersetzen durch `- Agent-Hub-Deployment`.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude): switch deployment target from Hetzner to Agent Hub"
```

---

## Task 2: `@memp/auth` — X-MSQ-Middleware + Dev-Bypass

**Files:**
- Create: `packages/auth/src/hub-middleware.ts`
- Create: `packages/auth/src/dev-user-config.ts`
- Create: `config/dev-user.yaml`
- Modify: `packages/auth/src/index.ts` (Exports umstellen)
- Delete: `packages/auth/src/middleware.ts`, `packages/auth/src/jwt.ts`, `packages/auth/src/password.ts`
- Test: `packages/auth/tests/hub-middleware.test.ts`

**Interfaces:**
- Consumes: `@memp/shared` (rootLogger, Errors), `hono` (Context, MiddlewareHandler), `zod`
- Produces:
  - `hubAuthMiddleware(): MiddlewareHandler` — mountable auf Hono-App
  - `type HubUser = { id: string; email: string | null; name: string | null; roles: string[]; groups: string[]; isGuest: boolean; isHubAdmin: boolean }`
  - `getHubUser(c: Context): HubUser` — Helper für Route-Handler
  - `requireRole(role: string)` und `requireHubAdmin()` — Guards

- [ ] **Step 1: Write the failing test — Header-Parsing**

Create `packages/auth/tests/hub-middleware.test.ts`:

```typescript
import { Hono } from "hono";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { hubAuthMiddleware, getHubUser } from "../src/hub-middleware.js";

describe("hubAuthMiddleware", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.NODE_ENV = "production";
    process.env.AUTH_MODE = "hub";
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns 401 when X-MSQ-User-Id is missing in hub mode", async () => {
    const app = new Hono();
    app.use("*", hubAuthMiddleware());
    app.get("/x", (c) => c.text("ok"));

    const res = await app.request("/x");
    expect(res.status).toBe(401);
  });

  it("passes when X-MSQ-User-Id is present and populates user", async () => {
    const app = new Hono();
    app.use("*", hubAuthMiddleware());
    app.get("/x", (c) => {
      const u = getHubUser(c);
      return c.json({ id: u.id, roles: u.roles, isHubAdmin: u.isHubAdmin });
    });

    const res = await app.request("/x", {
      headers: {
        "X-MSQ-User-Id": "user-1",
        "X-MSQ-User-Email": "max@mindsquare.de",
        "X-MSQ-User-Name": "Max",
        "X-MSQ-Roles": "Marketing,AppHub.Admin",
      },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ id: "user-1", roles: ["Marketing", "AppHub.Admin"], isHubAdmin: true });
  });

  it("flags guest requests", async () => {
    const app = new Hono();
    app.use("*", hubAuthMiddleware());
    app.get("/x", (c) => c.json({ isGuest: getHubUser(c).isGuest }));

    const res = await app.request("/x", {
      headers: { "X-MSQ-User-Id": "guest-abc", "X-MSQ-Guest": "true" },
    });
    expect(await res.json()).toEqual({ isGuest: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @memp/auth test
```
Expected: FAIL — module `hub-middleware.js` not found.

- [ ] **Step 3: Implement `hub-middleware.ts`**

Create `packages/auth/src/hub-middleware.ts`:

```typescript
import type { Context, MiddlewareHandler } from "hono";
import { rootLogger } from "@memp/shared";
import { loadDevUser } from "./dev-user-config.js";

export type HubUser = {
  id: string;
  email: string | null;
  name: string | null;
  roles: string[];
  groups: string[];
  authTime: string | null;
  isGuest: boolean;
  isHubAdmin: boolean;
};

const CONTEXT_KEY = "hubUser" as const;
const log = rootLogger.child({ module: "auth/hub-middleware" });

function parseCsv(value: string | undefined): string[] {
  return (value ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

function resolveAuthMode(): "hub" | "dev-bypass" {
  const raw = process.env.AUTH_MODE;
  if (raw === "hub" || raw === "dev-bypass") return raw;
  return process.env.NODE_ENV === "production" ? "hub" : "dev-bypass";
}

export function hubAuthMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    const mode = resolveAuthMode();

    if (c.req.path === "/health" || c.req.path === "/ready") {
      return next();
    }

    let user: HubUser | null = null;
    const userId = c.req.header("x-msq-user-id");

    if (userId) {
      const roles = parseCsv(c.req.header("x-msq-roles"));
      user = {
        id: userId,
        email: c.req.header("x-msq-user-email") ?? null,
        name: c.req.header("x-msq-user-name") ?? null,
        roles,
        groups: parseCsv(c.req.header("x-msq-groups")),
        authTime: c.req.header("x-msq-auth-time") ?? null,
        isGuest: c.req.header("x-msq-guest") === "true",
        isHubAdmin: roles.includes("AppHub.Admin"),
      };
    } else if (mode === "dev-bypass") {
      const dev = loadDevUser();
      user = {
        id: dev.id,
        email: dev.email,
        name: dev.name,
        roles: dev.roles,
        groups: [],
        authTime: new Date().toISOString(),
        isGuest: false,
        isHubAdmin: dev.roles.includes("AppHub.Admin"),
      };
      log.debug({ userId: dev.id }, "dev-bypass user injected");
    }

    if (!user) {
      return c.json({ error: "unauthorized", reason: "missing X-MSQ-User-Id" }, 401);
    }

    c.set(CONTEXT_KEY, user);
    return next();
  };
}

export function getHubUser(c: Context): HubUser {
  const u = c.get(CONTEXT_KEY) as HubUser | undefined;
  if (!u) throw new Error("hubAuthMiddleware not mounted before this handler");
  return u;
}

export function requireHubAdmin(): MiddlewareHandler {
  return async (c, next) => {
    const u = getHubUser(c);
    if (!u.isHubAdmin) return c.json({ error: "forbidden" }, 403);
    return next();
  };
}

export function requireRole(role: string): MiddlewareHandler {
  return async (c, next) => {
    const u = getHubUser(c);
    if (u.isHubAdmin) return next();
    if (u.roles.includes(role)) return next();
    return c.json({ error: "forbidden", requiredRole: role }, 403);
  };
}
```

- [ ] **Step 4: Create Dev-User-Config Loader**

Create `packages/auth/src/dev-user-config.ts`:

```typescript
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";

const DevUserSchema = z.object({
  id: z.string().min(1),
  email: z.string().email().nullable().default(null),
  name: z.string().nullable().default(null),
  roles: z.array(z.string()).default([]),
});

export type DevUser = z.infer<typeof DevUserSchema>;

const DEFAULT_DEV_USER: DevUser = {
  id: "dev-user-default",
  email: "dev@mindsquare.local",
  name: "Dev User",
  roles: ["AppHub.Admin"],
};

let cached: DevUser | null = null;

export function loadDevUser(): DevUser {
  if (cached) return cached;
  const path = resolve(process.cwd(), "config/dev-user.yaml");
  if (!existsSync(path)) {
    cached = DEFAULT_DEV_USER;
    return cached;
  }
  const raw = readFileSync(path, "utf8");
  const parsed = DevUserSchema.parse(parseYaml(raw));
  cached = parsed;
  return parsed;
}
```

- [ ] **Step 5: Create `config/dev-user.yaml`**

Create `config/dev-user.yaml`:

```yaml
# Wird nur geladen wenn AUTH_MODE=dev-bypass (Default in NODE_ENV != production).
# Simuliert einen vom Hub durchgereichten User. NIE in Produktion aktiv.
id: dev-user-sina
email: sina.strathemann@mindsquare.de
name: Sina Strathemann
roles:
  - AppHub.Admin
```

- [ ] **Step 6: Rewrite `packages/auth/src/index.ts`**

Replace file content:

```typescript
export {
  hubAuthMiddleware,
  getHubUser,
  requireHubAdmin,
  requireRole,
  type HubUser,
} from "./hub-middleware.js";

export { loadDevUser, type DevUser } from "./dev-user-config.js";
```

- [ ] **Step 7: Delete obsolete files**

```bash
rm packages/auth/src/middleware.ts packages/auth/src/jwt.ts packages/auth/src/password.ts
```

- [ ] **Step 8: Update `packages/auth/package.json` dependencies**

Ensure `yaml` and `zod` are in dependencies:

```bash
pnpm --filter @memp/auth add yaml zod
pnpm --filter @memp/auth remove jose bcryptjs @types/bcryptjs 2>/dev/null || true
```

- [ ] **Step 9: Run tests to verify they pass**

```bash
pnpm --filter @memp/auth test
pnpm --filter @memp/auth build
pnpm --filter @memp/auth typecheck
```
Expected: All three green.

- [ ] **Step 10: Commit**

```bash
git add packages/auth/ config/dev-user.yaml
git commit -m "feat(auth): replace cookie-session with X-MSQ hub middleware + dev-bypass"
```

---

## Task 3: API-Entrypoint — Middleware montieren + `/auth`-Routes reshape + Static-Serve

**Files:**
- Modify: `apps/api/src/index.ts`
- Modify: `apps/api/src/routes/auth.ts` (shrink to `/me`)
- Modify: `apps/api/src/routes/admin-users.ts` (remove password endpoints)
- Create: `apps/api/src/static-serve.ts`
- Test: `apps/api/tests/integration/auth-flow.test.ts`

**Interfaces:**
- Consumes: `hubAuthMiddleware`, `getHubUser`, `requireHubAdmin` (from Task 2)
- Produces: HTTP-API mit gemounteter Hub-Middleware; alle Routes bekommen `HubUser` via `getHubUser(c)`; Web-Assets werden für Nicht-API-Paths serviert

- [ ] **Step 1: Create static-serve helper**

Create `apps/api/src/static-serve.ts`:

```typescript
import { serveStatic } from "@hono/node-server/serve-static";
import type { Hono } from "hono";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { rootLogger } from "@memp/shared";

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
```

- [ ] **Step 2: Rewrite `apps/api/src/routes/auth.ts` — nur noch `/me`**

Replace file content:

```typescript
import { getHubUser } from "@memp/auth";
import { Hono } from "hono";

export const authRoutes = new Hono();

authRoutes.get("/me", (c) => {
  const u = getHubUser(c);
  return c.json({
    id: u.id,
    email: u.email,
    name: u.name,
    roles: u.roles,
    groups: u.groups,
    isHubAdmin: u.isHubAdmin,
    isGuest: u.isGuest,
    authTime: u.authTime,
  });
});
```

- [ ] **Step 3: Modify `apps/api/src/routes/admin-users.ts` — remove password endpoints**

Open the file and remove:
- Any `POST /:id/password` route (Passwort-Reset)
- Any `password` field from user-creation request schemas — replace with just `id`, `email`, `displayName`, `roles`

If the file references `hashPassword` or similar from `@memp/auth`, remove those imports. Replace any `req.body.password`-usage with error `400 password endpoints removed — auth handled by Hub`.

For "create user" flow: users are auto-registered on first request (see Task 3, Step 4 for auto-registration in middleware chain). Manual admin-create becomes: only stores `id` (must equal Entra oid), `displayName`, `roles`. No password.

- [ ] **Step 4: Rewrite `apps/api/src/index.ts`**

Replace file content:

```typescript
import "./bootstrap.js";

import { serve } from "@hono/node-server";
import { hubAuthMiddleware, requireHubAdmin } from "@memp/auth";
import { rootLogger } from "@memp/shared";
import { Hono } from "hono";
import { resolve } from "node:path";
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

// Hub-Auth for everything below
app.use("*", hubAuthMiddleware());

app.route("/me", authRoutes);
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
```

Note: `authRoutes` is mounted at `/me` now (single endpoint). All other route files inherit user via `getHubUser(c)` — grep the existing routes for old `getSessionUser`/`req.user`-style code and swap.

- [ ] **Step 5: Update all route files to use `getHubUser`**

For every file under `apps/api/src/routes/`:

```bash
grep -l "getSessionUser\|c.get(\"user\")\|req.user" apps/api/src/routes/
```

For each hit, replace with:

```typescript
import { getHubUser } from "@memp/auth";
// ...
const user = getHubUser(c);
// user.id, user.email, user.roles, user.isHubAdmin
```

**Role-check migration:**
- Old: `if (userRoles.includes("admin"))` → New: `if (user.isHubAdmin || user.roles.includes("admin"))`
- The `admin`, `manager`, `event_office`, `budget_owner`, `werkstudent`, `participant` are internal mEMP roles held in the user store, keyed by `user.id`. Load them from the user store using `user.id` as key, treat `AppHub.Admin` as unconditional admin override.

If auto-registration is needed for unknown users: in a shared helper `apps/api/src/routes/_user-resolution.ts`:

```typescript
import { getHubUser } from "@memp/auth";
import type { Context } from "hono";
import { devUserStore } from "./_stores.js"; // adjust to real store path

export function resolveMempRoles(c: Context): string[] {
  const hub = getHubUser(c);
  if (hub.isHubAdmin) return ["admin"];
  const known = devUserStore.get(hub.id);
  if (known) return known.roles;
  // Auto-register unknown users
  const fresh = { id: hub.id, email: hub.email, displayName: hub.name, roles: ["participant"] };
  devUserStore.set(hub.id, fresh);
  return fresh.roles;
}
```

Adjust the exact store name to match the current codebase (`persistentMap`-based user store).

- [ ] **Step 6: Write integration test**

Create `apps/api/tests/integration/auth-flow.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { spawn } from "node:child_process";

describe("API auth flow (integration)", () => {
  it("health returns 200 without auth headers", async () => {
    const res = await fetch("http://localhost:3000/health");
    expect(res.status).toBe(200);
  });

  it("events returns 401 without X-MSQ-User-Id in hub mode", async () => {
    const res = await fetch("http://localhost:3000/events");
    expect(res.status).toBe(401);
  });

  it("events returns 200 with X-MSQ headers", async () => {
    const res = await fetch("http://localhost:3000/events", {
      headers: {
        "X-MSQ-User-Id": "test-user",
        "X-MSQ-User-Email": "test@mindsquare.de",
        "X-MSQ-Roles": "AppHub.Admin",
      },
    });
    expect(res.status).toBe(200);
  });
});
```

Note: This test requires the API to be running with `AUTH_MODE=hub`. Skip in default `pnpm test` runs; run manually with the API server up.

- [ ] **Step 7: Run typecheck + build**

```bash
pnpm --filter @memp/api typecheck
pnpm --filter @memp/api build
```
Expected: Both green. Fix any compile errors from removed `middleware.ts` imports.

- [ ] **Step 8: Manual smoke — start API and hit endpoints**

```bash
pnpm dev:api
```
In another terminal:
```bash
curl -sS -o /dev/null -w "health: %{http_code}\n" http://localhost:3000/health
curl -sS -o /dev/null -w "events unauth: %{http_code}\n" http://localhost:3000/events
curl -sS -o /dev/null -w "events dev-bypass: %{http_code}\n" \
  -H "X-MSQ-User-Id: sina" -H "X-MSQ-Roles: AppHub.Admin" http://localhost:3000/events
```
Expected: `health: 200`, `events unauth: 401`, `events dev-bypass: 200`.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/ apps/api/tests/
git commit -m "feat(api): mount X-MSQ auth middleware, serve SPA, drop cookie-session routes"
```

---

## Task 4: Frontend-Cleanup — Login weg, Vite-Base, Waffle-Script

**Files:**
- Delete: `apps/web/src/pages/login.tsx`
- Modify: `apps/web/src/app.tsx` (remove login route, add logout link)
- Modify: `apps/web/index.html` (add waffle script)
- Modify: `apps/web/vite.config.ts` (`base: "./"`)
- Modify: `apps/web/src/auth/*` (drop login-form logic, use `/me` endpoint)

**Interfaces:**
- Consumes: `/me` endpoint from Task 3
- Produces: SPA that bootstraps by calling `/me`, redirects to Hub if 401, shows Waffle in header

- [ ] **Step 1: Modify `apps/web/vite.config.ts`**

Ensure `base: "./"` is set. Show relevant section:

```typescript
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: false,
  },
  server: {
    port: 8080,
    proxy: {
      "/events": "http://localhost:3000",
      "/me": "http://localhost:3000",
      "/admin": "http://localhost:3000",
      "/dashboard": "http://localhost:3000",
      "/reports": "http://localhost:3000",
      "/my": "http://localhost:3000",
      "/tenders": "http://localhost:3000",
      "/vendors": "http://localhost:3000",
      "/blueprints": "http://localhost:3000",
      "/budgets": "http://localhost:3000",
      "/documents": "http://localhost:3000",
      "/feedback": "http://localhost:3000",
      "/registration-forms": "http://localhost:3000",
      "/qna": "http://localhost:3000",
      "/health": "http://localhost:3000",
    },
  },
});
```

Adjust proxy paths to match actual API route prefixes in the codebase.

- [ ] **Step 2: Modify `apps/web/index.html`**

Add the waffle script inside `<head>` (before closing tag):

```html
<script src="/embed/waffle.js" defer></script>
```

Verify no other absolute-path assumptions. Vite generates hashed asset refs; `base: "./"` handles those.

- [ ] **Step 3: Delete login page**

```bash
rm apps/web/src/pages/login.tsx
```

- [ ] **Step 4: Modify `apps/web/src/app.tsx`**

Remove the login route. Bootstrapping flow becomes:
- App calls `GET /me` on mount
- If 200 → render main app
- If 401 → redirect to `/auth/logout` (Hub picks it up, forwards to SSO login)

Concrete change: find the `<Route path="/login" ...>` block and delete it. In the auth-context provider, replace login-form-logic with:

```tsx
useEffect(() => {
  fetch("/me")
    .then((r) => {
      if (r.status === 401) {
        window.location.href = "/auth/logout";
        return null;
      }
      return r.json();
    })
    .then((user) => {
      if (user) setUser(user);
    });
}, []);
```

- [ ] **Step 5: Update logout link**

Find every place a logout button or link is rendered (grep `Abmelden|logout`). Replace with:

```tsx
<a href="/auth/logout">Abmelden</a>
```

- [ ] **Step 6: Typecheck + build web**

```bash
pnpm --filter @memp/web typecheck
pnpm --filter @memp/web build
```
Expected: Both green. `apps/web/dist/index.html` exists with the waffle-script.

- [ ] **Step 7: Verify build output**

```bash
grep -c "embed/waffle.js" apps/web/dist/index.html
grep -c "./assets/" apps/web/dist/index.html
```
Expected: Both `>=1`.

- [ ] **Step 8: Commit**

```bash
git add apps/web/
git commit -m "feat(web): remove login form, add Hub waffle, use relative base for sub-path"
```

---

## Task 5: Dockerfile Rewrite + `.env.example` + `.dockerignore`

**Files:**
- Rewrite: `docker/Dockerfile`
- Create/Rewrite: `.env.example`
- Create/Modify: `.dockerignore`

**Interfaces:**
- Consumes: Built artifacts from Tasks 2, 3, 4
- Produces: Docker image that satisfies Hub contract A.1.1–A.1.7 and A.2.7

- [ ] **Step 1: Rewrite `docker/Dockerfile`**

Replace file content:

```dockerfile
# syntax=docker/dockerfile:1.7

# ---- Base ----
FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# ---- Deps ----
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
COPY packages/domain/package.json ./packages/domain/
COPY packages/application/package.json ./packages/application/
COPY packages/infrastructure/package.json ./packages/infrastructure/
COPY packages/auth/package.json ./packages/auth/
COPY packages/llm/package.json ./packages/llm/
COPY packages/mcp/package.json ./packages/mcp/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ---- Build ----
FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY tsconfig.base.json tsconfig.json biome.json ./
COPY packages ./packages
COPY apps ./apps
RUN pnpm --filter "./packages/*" build
RUN pnpm --filter @memp/api build
RUN pnpm --filter @memp/web build
RUN pnpm deploy --filter @memp/api --prod /app/deploy

# ---- Runtime ----
FROM node:22-alpine AS runtime
ARG APP_VERSION=dev
WORKDIR /app

ENV NODE_ENV=production
ENV AUTH_MODE=hub
ENV MEMP_DATA_DIR=/app/data
ENV MEMP_WEB_DIST=/app/web-dist
ENV PORT=3000
ENV HOST=0.0.0.0
ENV APP_VERSION=${APP_VERSION}
ENV TZ=Europe/Berlin

COPY --from=build /app/deploy/package.json ./
COPY --from=build /app/deploy/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/web/dist ./web-dist
COPY config ./config
COPY .env.example /app/.env.example

RUN mkdir -p /app/data && chown -R node:node /app/data
USER node

VOLUME /app/data
EXPOSE 3000

LABEL org.opencontainers.image.title="mEMP" \
      org.opencontainers.image.description="mindsquare Event Management Platform" \
      org.opencontainers.image.vendor="mindsquare AG" \
      org.opencontainers.image.source="https://github.com/sinastrathemann/memp" \
      org.opencontainers.image.documentation="https://github.com/sinastrathemann/memp/blob/main/README.md" \
      org.opencontainers.image.licenses="proprietary" \
      org.opencontainers.image.version="${APP_VERSION}" \
      de.mindsquare.agenthub.category="hr" \
      de.mindsquare.agenthub.brand="memp" \
      de.mindsquare.agenthub.capabilities="events,budget,tender,reporting"

CMD ["node", "dist/index.js"]
```

- [ ] **Step 2: Rewrite `.env.example`**

Replace file content:

```dotenv
# mEMP — Environment Reference
# Wird beim Hub-Onboarding automatisch aus dem Image gelesen.

# Auth-Modus: "hub" (Produktion, X-MSQ-Header-Pflicht) | "dev-bypass" (lokal)
AUTH_MODE=hub

# Verzeichnis für persistente JSON-Files (im Container: benanntes Volume)
MEMP_DATA_DIR=/app/data

# HTTP-Server
PORT=3000
HOST=0.0.0.0

# Zeitzone für Log-Timestamps und Terminberechnung
TZ=Europe/Berlin

# Log-Level: debug | info | warn | error
LOG_LEVEL=info

# Node-Umgebung (production erzwingt AUTH_MODE=hub Default)
NODE_ENV=production
```

- [ ] **Step 3: Create/Update `.dockerignore`**

Ensure content:

```
node_modules
**/node_modules
**/dist
apps/*/dist
packages/*/dist
apps/api/data
.env
.env.local
.git
.github
docs
specs
tests
**/*.test.ts
coverage
```

**Important:** `.env.example` must NOT be excluded — it's needed in the image.

- [ ] **Step 4: Build the image locally**

```bash
docker build -f docker/Dockerfile -t memp:local --build-arg APP_VERSION=dev .
```
Expected: Build succeeds, image size roughly 200-400MB.

- [ ] **Step 5: Inspect labels + env**

```bash
docker image inspect memp:local --format '{{ json .Config.Labels }}' | jq .
docker image inspect memp:local --format '{{ .Config.ExposedPorts }}'
docker image inspect memp:local --format '{{ .Config.Volumes }}'
```
Expected:
- Labels contain `de.mindsquare.agenthub.category="hr"` and `org.opencontainers.image.source`
- ExposedPorts contains `3000/tcp`
- Volumes contains `/app/data`

- [ ] **Step 6: Verify `.env.example` in image**

```bash
docker run --rm --entrypoint cat memp:local /app/.env.example | head -5
```
Expected: First lines of the env file printed.

- [ ] **Step 7: Smoke-run the container**

```bash
docker run --rm -d --name memp-smoke -p 3000:3000 -e AUTH_MODE=hub memp:local
sleep 3
curl -sS -o /dev/null -w "health: %{http_code}\n" http://localhost:3000/health
curl -sS -o /dev/null -w "events unauth: %{http_code}\n" http://localhost:3000/events
curl -sS -o /dev/null -w "events auth: %{http_code}\n" -H "X-MSQ-User-Id: t" -H "X-MSQ-Roles: AppHub.Admin" http://localhost:3000/events
curl -sS -o /dev/null -w "spa: %{http_code}\n" http://localhost:3000/
curl -sS -I http://localhost:3000/ | grep -i cache-control
docker stop memp-smoke
```
Expected:
- `health: 200`
- `events unauth: 401`
- `events auth: 200`
- `spa: 200`
- `Cache-Control: no-cache, must-revalidate` on SPA

- [ ] **Step 8: Commit**

```bash
git add docker/Dockerfile .env.example .dockerignore
git commit -m "feat(docker): rewrite Dockerfile for Hub-managed deploy (labels, volume, waffle-ready web)"
```

---

## Task 6: GitHub-Actions — Publish + CI

**Files:**
- Create: `.github/workflows/publish-container.yml`
- Create: `.github/workflows/ci.yml`
- Create: `.github/dependabot.yml`

**Interfaces:**
- Consumes: `docker/Dockerfile` from Task 5
- Produces: Package under `ghcr.io/sinastrathemann/memp` auto-updated on push

- [ ] **Step 1: Create `.github/workflows/publish-container.yml`**

```yaml
name: Publish Container

on:
  push:
    branches: [main]
    tags: ["v*"]
  workflow_dispatch:

concurrency:
  group: publish-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read
  packages: write
  id-token: write

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/sinastrathemann/memp
          tags: |
            type=raw,value=latest,enable={{is_default_branch}}
            type=sha,format=short
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
          labels: |
            org.opencontainers.image.title=mEMP
            org.opencontainers.image.description=mindsquare Event Management Platform

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          file: docker/Dockerfile
          push: true
          platforms: linux/amd64
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          build-args: |
            APP_VERSION=${{ steps.meta.outputs.version }}
          provenance: true
          sbom: true
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

- [ ] **Step 2: Create `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v3
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Install
        run: pnpm install --frozen-lockfile

      - name: Typecheck
        run: pnpm -r typecheck

      - name: Lint
        run: pnpm lint

      - name: Test
        run: pnpm -r test --if-present
        env:
          NODE_ENV: test
```

- [ ] **Step 3: Create `.github/dependabot.yml`**

```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
    open-pull-requests-limit: 5
    groups:
      minor-and-patch:
        update-types: [minor, patch]
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
  - package-ecosystem: docker
    directory: /docker
    schedule:
      interval: monthly
```

- [ ] **Step 4: Commit workflows**

```bash
git add .github/
git commit -m "ci: add publish-container + ci workflows and dependabot"
```

- [ ] **Step 5: Push and verify**

```bash
git push origin main
```

Then in browser: open `https://github.com/sinastrathemann/memp/actions` — verify `Publish Container` runs green.
After success, verify: `https://github.com/sinastrathemann/memp/pkgs/container/memp` exists.

- [ ] **Step 6: Set package visibility**

Open `https://github.com/users/sinastrathemann/packages/container/memp/settings` and either:
- Set to **Public** (simplest, no Hub-side credentials needed), OR
- Keep **Private** and coordinate with the Hub-Operator to add a GHCR PAT under Hub-Admin → Git-Hosts

Document the choice in `docs/agent-hub-integration.md` (Task 7).

---

## Task 7: Dokumentation — README + Agent-Hub-Integration-Doc

**Files:**
- Rewrite: `README.md`
- Create: `docs/agent-hub-integration.md`
- Modify: `docs/runbook.md` (Deploy-Section)

**Interfaces:**
- Consumes: Package-URL from Task 6
- Produces: Contract A.1.6-compliant README, plus Hub-Admin-facing deploy documentation

- [ ] **Step 1: Rewrite `README.md`**

Replace file content:

````markdown
# mEMP — mindsquare Event Management Platform

Interne HR-zentrierte Event-Plattform für mindsquare AG. Deckt den Lifecycle interner Events (Schulungen, Workshops, Feelgood-Events, Bereichsevents, mindsquare-Events, …) ab: Portfolio, Teilnehmerverwaltung, Budget, Dokumente, Check-in, Reporting.

## Container

- 📦 **Package**: https://github.com/sinastrathemann/memp/pkgs/container/memp
- Image-Ref zum Einhängen in den Agent Hub:

  ```
  ghcr.io/sinastrathemann/memp:latest
  ```

Für eine pinned Version einen Release-Tag verwenden (z. B. `:v1.0.0`).

## Deployment

mEMP läuft als **Managed Agent** im mindsquare Agent Hub — SSO über Entra ID, Container-Lifecycle managed vom Hub. Onboarding-Details siehe [`docs/agent-hub-integration.md`](docs/agent-hub-integration.md).

## Lokale Entwicklung

```bash
pnpm install
pnpm dev            # API + Web parallel
# oder:
pnpm dev:api        # nur API auf :3000
pnpm dev:web        # nur Web auf :8080
```

Standardmäßig läuft die App lokal mit `AUTH_MODE=dev-bypass` — der User aus [`config/dev-user.yaml`](config/dev-user.yaml) wird als angemeldet simuliert. Anpassen für Rollen-Switches.

## Stack

- **Runtime**: Node.js 22, TypeScript 5 strict, ES Modules
- **Backend**: Hono, Zod, `@hono/node-server`
- **Frontend**: Vite + React + TanStack Query + react-i18next
- **Persistence**: Docker-Volume `/app/data` (JSON-Files via `persistentMap`); Postgres via Drizzle folgt in Phase 2
- **Auth**: `X-MSQ-*`-Header vom Agent Hub → `packages/auth` Middleware
- **Tooling**: pnpm workspaces, Biome, Vitest

## Verzeichnisstruktur

- `apps/api/` — Hono HTTP-API (serviert außerdem die gebauten Web-Assets)
- `apps/web/` — React UI
- `packages/{domain,application,infrastructure,auth,shared,llm,mcp}/` — Fachlogik, DB, M365-Adapter, Utilities
- `docs/mindCoder/` — Design-Specs und Implementierungspläne
- `docker/` — Dockerfile (Multi-Stage, produziert das GHCR-Image)

## Commands

- `pnpm dev` / `pnpm dev:api` / `pnpm dev:web` — lokale Entwicklung
- `pnpm build` — Packages + Apps bauen
- `pnpm lint` / `pnpm -r typecheck` — Qualitäts-Checks
- `pnpm -r test` — Vitest
- `docker build -f docker/Dockerfile -t memp:local .` — lokales Container-Image

## Referenzen

- [Architektur](docs/architecture.md)
- [Datenklassifikation](docs/data-classification.md)
- [Runbook (Deploy, Rollback)](docs/runbook.md)
- [Agent-Hub-Integration](docs/agent-hub-integration.md)
- [Design-Specs](docs/mindCoder/specs/) und [Implementierungspläne](docs/mindCoder/plans/)
````

- [ ] **Step 2: Create `docs/agent-hub-integration.md`**

```markdown
# Agent-Hub-Integration — Hub-Admin-Handout

Dieser Guide richtet sich an den Agent-Hub-Operator, der mEMP im Hub-Admin-UI einträgt.

## Registrierungs-Werte

Alle Felder zum Copy-Paste ins Hub-Admin-Formular:

| Feld | Wert |
|---|---|
| Anzeigename | mEMP — Event Management |
| Slug | `memp` |
| Beschreibung | mindsquare Event Management Platform — Events, Budget, Anmeldungen, Reporting |
| Icon | 📅 |
| Kategorie | `hr` |
| Image-Ref | `ghcr.io/sinastrathemann/memp:latest` |
| Container-Port | `3000` (aus `EXPOSE` im Image) |
| Health-Pfad | `/health` |
| Timeout | `30s` (Standard) |
| Body-Limit | `50 MB` (Standard, ausreichend für PDF-Rechnungen) |
| Salesforce-Integration | nein |

## Zugriff

**Alle angemeldeten Mitarbeiter der mindsquare AG.** Feingranulare mEMP-Rollen (admin, event_office, werkstudent, budget_owner, participant) werden **in mEMP** gepflegt — verknüpft über die Entra-User-ID. Unbekannte User werden beim ersten Request automatisch als `participant` registriert.

**Hub-Admin-Marker:** Ein User mit `AppHub.Admin` in `X-MSQ-Roles` gilt in mEMP automatisch als mEMP-Admin — unabhängig von seiner in mEMP gespeicherten Rollenzuweisung.

## Env-Variablen (Tab „Container-Einstellungen")

Werden im Hub-UI eingetragen; die `.env.example` aus dem Image ist vorbefüllt:

```
NODE_ENV=production
AUTH_MODE=hub
MEMP_DATA_DIR=/app/data
PORT=3000
HOST=0.0.0.0
TZ=Europe/Berlin
LOG_LEVEL=info
```

## Volumes

Persistenter State (Event-JSON-Overrides, Uploads, Registrierungsdaten):

```
appdata-memp-data → /app/data
```

Der Hub schlägt das automatisch vor (VOLUME-Direktive im Image).

## Registry-Zugriff

Das Package `ghcr.io/sinastrathemann/memp` liegt im GitHub Container Registry des Personal-Accounts `sinastrathemann`. Zwei Optionen für den Hub-Pull:

1. **Package auf public setzen** (Empfehlung falls keine sensible Repo-Sichtbarkeit nötig) — dann keine Auth beim Pull.
2. **Package bleibt private** — der Hub-Operator legt einen Git-Host für `ghcr.io` mit einem GitHub-PAT (Scopes: `read:packages`) an.

Aktuell gewählt: **`__TODO_INSERT_CHOICE__`** — bitte nach Task 6 Step 6 eintragen.

## Deploy-Ablauf

1. Entwickler pusht auf `main` → GitHub-Actions baut neues Image → `ghcr.io/sinastrathemann/memp:latest` und `ghcr.io/sinastrathemann/memp:sha-<abbrev>`
2. Hub-Admin öffnet `https://<hub-domain>/admin/apps/memp` → **Neue Version einspielen** → Tag wählen (`latest` oder `sha-...`)
3. Hub führt `docker pull` + Container-Neustart aus. Rollback via **Vorherige Version wiederherstellen**.

## SPA-Cache-Verhalten

- `index.html` wird mit `Cache-Control: no-cache, must-revalidate` ausgeliefert → nach Deploy laden alle User die neuen Asset-Hashes.
- `/assets/*` (content-gehasht) mit `Cache-Control: public, max-age=31536000, immutable`.

## Smoke-Test nach Registrierung

```bash
# vom Browser (nach Hub-Login)
open https://<hub-domain>/memp/

# vom Terminal (führt zum Hub-Login-Redirect, nicht direkt zur App)
curl -I https://<hub-domain>/memp/health
```

Erwartung: Waffle-Menü oben rechts vorhanden, Feedback-Button funktioniert (öffnet Issue in `sinastrathemann/memp`).
```

- [ ] **Step 3: Update `docs/runbook.md` Deploy-Section**

Find the `## Deployment` / `## Deploy` heading (or add one) and replace/append with:

```markdown
## Deploy

**Target:** mindsquare Agent Hub (Managed)

Der Deploy erfolgt via GitHub-Actions automatisch:

1. Push auf `main` → Workflow `Publish Container` baut `ghcr.io/sinastrathemann/memp:latest`
2. Hub-Admin: **App-Detailseite → Neue Version** → Tag wählen oder `latest` re-pullen
3. Hub startet Container neu. Alter Container läuft bis neuer healthy ist.

**Rollback:** Hub-Admin-UI → "Vorherige Version". Achtung: Nur das Image wird zurückgerollt, nicht das Volume (`appdata-memp-data`). Wenn eine Schema-Migration passiert ist, muss sie idempotent + additiv sein.

**Manueller Trigger:** In GitHub → Actions → `Publish Container` → `Run workflow`.
```

- [ ] **Step 4: Commit**

```bash
git add README.md docs/agent-hub-integration.md docs/runbook.md
git commit -m "docs: README with GHCR container block, add hub-integration handout"
```

---

## Task 8: End-to-End DoD Smoke-Test

**Files:**
- Create: `docs/mindCoder/plans/2026-07-15-agent-hub-integration-dod.md` (Ergebnisprotokoll)

**Interfaces:**
- Consumes: Alle vorherigen Tasks
- Produces: Nachweis dass Vertrag A.5 erfüllt ist

- [ ] **Step 1: Pull the published image**

```bash
docker pull ghcr.io/sinastrathemann/memp:latest
```
Expected: Pull succeeds.

- [ ] **Step 2: Run container in Hub-simulation mode**

```bash
docker run --rm -d --name memp-dod \
  -p 3000:3000 \
  -v memp-dod-data:/app/data \
  -e AUTH_MODE=hub \
  ghcr.io/sinastrathemann/memp:latest
sleep 5
```

- [ ] **Step 3: Verify Vertrag A.1.2 — /health ohne Auth**

```bash
curl -sS -w "\n%{http_code}\n" http://localhost:3000/health
```
Expected: `200`, body includes `"status":"ok"`.

- [ ] **Step 4: Verify Vertrag A.1.3 — EXPOSE 3000**

```bash
docker image inspect ghcr.io/sinastrathemann/memp:latest --format '{{ .Config.ExposedPorts }}'
```
Expected: `map[3000/tcp:{}]`.

- [ ] **Step 5: Verify Vertrag A.1.4 — 401 ohne X-MSQ**

```bash
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:3000/events
```
Expected: `401`.

- [ ] **Step 6: Verify Vertrag A.1.4 — 200 mit X-MSQ**

```bash
curl -sS -o /dev/null -w "%{http_code}\n" \
  -H "X-MSQ-User-Id: dod-user" \
  -H "X-MSQ-User-Email: dod@mindsquare.de" \
  -H "X-MSQ-Roles: AppHub.Admin" \
  http://localhost:3000/events
```
Expected: `200`.

- [ ] **Step 7: Verify Vertrag A.2.7 — SPA Cache-Header**

```bash
curl -sS -I http://localhost:3000/ | grep -i cache-control
```
Expected: `Cache-Control: no-cache, must-revalidate`.

- [ ] **Step 8: Verify A.2.5 — .env.example im Image**

```bash
docker run --rm --entrypoint cat ghcr.io/sinastrathemann/memp:latest /app/.env.example | head -3
```
Expected: First lines of the env template.

- [ ] **Step 9: Verify A.2.6 — OCI + Hub-Labels**

```bash
docker image inspect ghcr.io/sinastrathemann/memp:latest --format '{{ json .Config.Labels }}' | jq '{title:."org.opencontainers.image.title", source:."org.opencontainers.image.source", category:."de.mindsquare.agenthub.category"}'
```
Expected: All three fields populated.

- [ ] **Step 10: Verify A.2.3 — Volume-Persistenz**

```bash
docker exec memp-dod ls /app/data
# create test data via API
curl -sS -X POST http://localhost:3000/events \
  -H "X-MSQ-User-Id: dod" -H "X-MSQ-Roles: AppHub.Admin" \
  -H "Content-Type: application/json" \
  -d '{"title":"DoD-Test","eventType":"training","visibility":"internal","startAt":"2027-01-01T09:00:00Z","endAt":"2027-01-01T17:00:00Z","location":"Test"}'
docker stop memp-dod
docker run --rm -d --name memp-dod-2 -p 3000:3000 -v memp-dod-data:/app/data -e AUTH_MODE=hub ghcr.io/sinastrathemann/memp:latest
sleep 3
curl -sS -H "X-MSQ-User-Id: dod" -H "X-MSQ-Roles: AppHub.Admin" http://localhost:3000/events | grep -c "DoD-Test"
```
Expected: `>= 1` — event survived container restart.

- [ ] **Step 11: Cleanup**

```bash
docker stop memp-dod-2
docker volume rm memp-dod-data
```

- [ ] **Step 12: Write DoD result document**

Create `docs/mindCoder/plans/2026-07-15-agent-hub-integration-dod.md`:

```markdown
# DoD-Ergebnis: Agent-Hub-Integration

**Datum:** __DATUM_HEUTE__
**Getestetes Image:** `ghcr.io/sinastrathemann/memp:latest` (SHA: __IMAGE_SHA__)

## Vertrag-Kriterien

| Kriterium | Status | Nachweis |
|---|---|---|
| A.1.1 Registry (ghcr.io) | ✅ | Package unter github.com/sinastrathemann/memp/pkgs/container/memp |
| A.1.2 /health ohne Auth | ✅ | curl → 200 |
| A.1.3 EXPOSE 3000 | ✅ | docker image inspect |
| A.1.4 X-MSQ-Header-Pflicht | ✅ | 401 ohne, 200 mit Header |
| A.1.5 /auth/logout an Hub | ✅ | Logout-Link im Web verweist auf /auth/logout, kein eigener Route |
| A.1.6 README Container-Block | ✅ | Package-Link + Image-Ref oben in README.md |
| A.1.7 Waffle-Script | ✅ | grep in apps/web/dist/index.html |
| A.2.3 Volume-Persistenz | ✅ | Event überlebt Container-Restart |
| A.2.5 .env.example im Image | ✅ | docker run --entrypoint cat |
| A.2.6 OCI + Hub-Labels | ✅ | docker image inspect |
| A.2.7 SPA Cache-Header | ✅ | Cache-Control: no-cache, must-revalidate |

## Hub-Registrierung ausstehend

Siehe `docs/agent-hub-integration.md` — Registrierungs-Werte für den Hub-Operator sind vorbereitet.
```

- [ ] **Step 13: Commit final documentation**

```bash
git add docs/mindCoder/plans/2026-07-15-agent-hub-integration-dod.md
git commit -m "docs(mindCoder): DoD result for Agent-Hub-Integration"
```

---

## Post-Implementation Handoff

Nach erfolgreichem Task 8:

1. **Hub-Operator anschreiben** (mit Registration-Summary-Block aus `docs/agent-hub-integration.md`)
2. **Frühere Test-User** (`sina.strathemann@mindsquare.de` + Passwort etc.) sind obsolet — alte Sessions laufen ins Leere, User loggen sich via Hub-Redirect neu ein
3. **Bestehende `apps/api/data/*.json`** einmalig ins Hub-Volume kopieren:
   ```bash
   docker cp apps/api/data/. memp-hub-container:/app/data/
   ```
   (nur im Hub-Kontext relevant, wenn die produktive Instanz startet)

## Followups (nicht Teil dieses Plans)

- **Postgres-Migration**: Drizzle-Schemas ausrollen, `persistentMap` durch `drizzle-orm` ersetzen — separater Spec
- **M365 Mail/Calendar**: der ursprüngliche Brainstorming-Topic — separater Spec
- **KI-Modul (Phase 4)**: `packages/llm` und `packages/mcp` — separater Spec
- **UI-basiertes Dev-User-Switching**: Statt Config-File-Edit ein Dev-UI-Panel für Rollen-Switch
