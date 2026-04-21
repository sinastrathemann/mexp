import { ForbiddenError, UnauthorizedError, loadEnv } from "@memp/shared";
import type { MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
import { type SessionPayload, verifySession } from "./jwt.js";

export type AuthVariables = {
  auth: SessionPayload;
};

export function requireAuth(): MiddlewareHandler<{ Variables: AuthVariables }> {
  return async (c, next) => {
    const env = loadEnv();
    const token = getCookie(c, env.AUTH_SESSION_COOKIE_NAME);
    if (!token) {
      throw new UnauthorizedError("Nicht angemeldet");
    }
    const session = await verifySession(token, env.AUTH_JWT_SECRET);
    if (!session) {
      throw new UnauthorizedError("Session ungültig oder abgelaufen");
    }
    c.set("auth", session);
    await next();
  };
}

export function requireRole(
  ...allowedRoles: string[]
): MiddlewareHandler<{ Variables: AuthVariables }> {
  return async (c, next) => {
    const session = c.get("auth");
    if (!session) {
      throw new UnauthorizedError("Auth-Middleware fehlt vor requireRole");
    }
    const hasRole = session.roles.some((r) => allowedRoles.includes(r));
    if (!hasRole) {
      throw new ForbiddenError(`Erfordert Rolle: ${allowedRoles.join(" oder ")}`);
    }
    await next();
  };
}
