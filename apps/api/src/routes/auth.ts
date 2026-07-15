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
