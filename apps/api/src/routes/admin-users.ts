import { zValidator } from "@hono/zod-validator";
import { ROLE_NAMES } from "@memp/domain";
import { ConflictError, NotFoundError, rootLogger } from "@memp/shared";
import { Hono } from "hono";
import { z } from "zod";
import { type MempUser, mempUserStore, requireMempRole } from "./_user-resolution.js";

const log = rootLogger.child({ module: "api/admin-users" });

const roleNameSchema = z.enum(ROLE_NAMES);

// Kein Passwort mehr — Identität kommt vom Hub (Entra oid), mEMP verwaltet nur noch
// die internen Rollen. `id` MUSS der Hub-User-Id (Entra oid) entsprechen.
const createUserSchema = z.object({
  id: z.string().min(1),
  email: z.string().email().nullable().default(null),
  displayName: z.string().min(1).max(200),
  roles: z.array(roleNameSchema).optional(),
});

const setActiveSchema = z.object({ isActive: z.boolean() });
const assignRoleSchema = z.object({ role: roleNameSchema });

export const adminUserRoutes = new Hono();

adminUserRoutes.use("*", requireMempRole("admin"));

adminUserRoutes.get("/", (c) => {
  const list = Array.from(mempUserStore.values()).sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
  return c.json({ users: list });
});

adminUserRoutes.post("/", zValidator("json", createUserSchema), (c) => {
  const input = c.req.valid("json");
  if (mempUserStore.has(input.id)) {
    throw new ConflictError(`Benutzer bereits vorhanden: ${input.id}`, { userId: input.id });
  }
  const now = new Date().toISOString();
  const user: MempUser = {
    id: input.id,
    email: input.email,
    displayName: input.displayName,
    roles: input.roles ?? ["participant"],
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
  mempUserStore.set(user.id, user);
  log.info({ userId: user.id, roles: user.roles }, "Benutzer angelegt (Hub-verwaltet)");
  return c.json({ user }, 201);
});

adminUserRoutes.post("/:id/roles", zValidator("json", assignRoleSchema), (c) => {
  const userId = c.req.param("id");
  const { role } = c.req.valid("json");
  const user = mempUserStore.get(userId);
  if (!user) throw new NotFoundError("User", userId);
  if (!user.roles.includes(role)) {
    mempUserStore.set(userId, {
      ...user,
      roles: [...user.roles, role],
      updatedAt: new Date().toISOString(),
    });
    log.info({ userId, role }, "Rolle zugewiesen");
  }
  return c.json({ ok: true });
});

adminUserRoutes.delete("/:id/roles/:role", (c) => {
  const userId = c.req.param("id");
  const roleParam = c.req.param("role");
  const parsed = roleNameSchema.safeParse(roleParam);
  if (!parsed.success) {
    return c.json({ error: { code: "INVALID_ROLE", message: "Unbekannte Rolle" } }, 400);
  }
  const user = mempUserStore.get(userId);
  if (!user) throw new NotFoundError("User", userId);
  mempUserStore.set(userId, {
    ...user,
    roles: user.roles.filter((r) => r !== parsed.data),
    updatedAt: new Date().toISOString(),
  });
  log.info({ userId, role: parsed.data }, "Rolle entfernt");
  return c.json({ ok: true });
});

adminUserRoutes.patch("/:id/active", zValidator("json", setActiveSchema), (c) => {
  const userId = c.req.param("id");
  const { isActive } = c.req.valid("json");
  const user = mempUserStore.get(userId);
  if (!user) throw new NotFoundError("User", userId);
  mempUserStore.set(userId, { ...user, isActive, updatedAt: new Date().toISOString() });
  log.info({ userId, isActive }, "User-Aktiv-Status geändert");
  return c.json({ ok: true });
});
