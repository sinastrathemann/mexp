/**
 * mEMP-interne Rollen (admin, manager, event_office, budget_owner, werkstudent, participant,
 * read_only) leben getrennt von der Hub-Identität. Der Hub liefert nur, WER jemand ist
 * (X-MSQ-User-Id / X-MSQ-Roles / isHubAdmin) — welche mEMP-Rechte diese Person innerhalb der
 * App hat, verwalten wir selbst, keyed by Hub-User-Id.
 */
import { getHubUser } from "@memp/auth";
import type { Context, MiddlewareHandler } from "hono";
import { persistentMap } from "../dev-persistence.js";

export interface MempUser {
  id: string;
  email: string | null;
  displayName: string | null;
  roles: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Persistiert in apps/api/data/memp-users.json — bleibt bei Neustarts erhalten
export const mempUserStore = persistentMap<MempUser>("memp-users");

/**
 * Liefert die mEMP-internen Rollen des aktuell eingeloggten Hub-Users.
 * - Hub-Admins (isHubAdmin === true) bekommen immer ["admin"] — unconditional override.
 * - Unbekannte Hub-User werden beim ersten Request automatisch mit Rolle "participant" registriert.
 */
export function resolveMempRoles(c: Context): string[] {
  const hub = getHubUser(c);
  if (hub.isHubAdmin) return ["admin"];

  const known = mempUserStore.get(hub.id);
  if (known) return known.roles;

  const now = new Date().toISOString();
  const fresh: MempUser = {
    id: hub.id,
    email: hub.email,
    displayName: hub.name,
    roles: ["participant"],
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
  mempUserStore.set(hub.id, fresh);
  return fresh.roles;
}

/**
 * Middleware-Factory: lässt den Request durch, wenn der Hub-User Hub-Admin ist ODER
 * mindestens eine der übergebenen mEMP-internen Rollen besitzt. Ersetzt das alte
 * `requireRole(...roles)` (variadic) aus der gelöschten Cookie-Session-Middleware.
 */
export function requireMempRole(...allowed: string[]): MiddlewareHandler {
  return async (c, next) => {
    const hub = getHubUser(c);
    if (hub.isHubAdmin) return next();
    const mempRoles = resolveMempRoles(c);
    if (allowed.some((r) => mempRoles.includes(r))) return next();
    return c.json({ error: { code: "FORBIDDEN", message: "Nicht berechtigt" } }, 403);
  };
}
