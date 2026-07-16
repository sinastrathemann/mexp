import { rootLogger } from "@mexp/shared";
import type { Context, MiddlewareHandler } from "hono";
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
  return (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function resolveAuthMode(): "hub" | "dev-bypass" {
  const raw = process.env.AUTH_MODE;
  if (raw === "hub" || raw === "dev-bypass") return raw;
  return process.env.NODE_ENV === "production" ? "hub" : "dev-bypass";
}

export type HubAuthOptions = {
  /**
   * Path patterns that bypass Hub-identity resolution entirely (no synthetic user is
   * injected). Intended for routes that carry their own token-based auth — e.g. vendor
   * magic-link / Q&A endpoints reachable by external parties without Entra SSO.
   * Route handlers on these paths MUST NOT call `getHubUser(c)`.
   */
  publicPathPatterns?: readonly RegExp[];
};

export function hubAuthMiddleware(options: HubAuthOptions = {}): MiddlewareHandler {
  const publicPatterns = options.publicPathPatterns ?? [];
  return async (c, next) => {
    const mode = resolveAuthMode();

    if (c.req.path === "/health" || c.req.path === "/ready") {
      return next();
    }

    if (publicPatterns.some((re) => re.test(c.req.path))) {
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
