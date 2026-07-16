import { getHubUser } from "@memp/auth";
import { Hono } from "hono";
import { resolveMempRoles } from "./_user-resolution.js";

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

// mEMP-interne Rollen des aktuell eingeloggten Hub-Users — getrennt von `/me`, das nur
// die rohe Hub-Identität (X-MSQ-*-Header) liefert. `hasRole` im Frontend braucht die
// effektiven mEMP-Rollen (inkl. HubAdmin-Override), nicht die rohen Hub-Rollen.
authRoutes.get("/me/roles", (c) => {
  const hub = getHubUser(c);
  const mempRoles = resolveMempRoles(c);
  return c.json({
    userId: hub.id,
    isHubAdmin: hub.isHubAdmin,
    hubRoles: hub.roles,
    mempRoles,
    effectiveRoles: hub.isHubAdmin ? [...new Set([...mempRoles, "admin"])] : mempRoles,
  });
});
