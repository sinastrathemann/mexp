import { zValidator } from "@hono/zod-validator";
import {
  assignRole,
  createUser,
  listUsers,
  removeRole,
  resetUserPassword,
  setUserActive,
} from "@memp/application";
import { ROLE_NAMES, type RoleName } from "@memp/domain";
import { type AuthVariables, requireAuth, requireRole } from "@memp/auth";
import { Hono } from "hono";
import { z } from "zod";
import { hasher, roles, users } from "../deps.js";

const roleNameSchema = z.enum(ROLE_NAMES);

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Passwort muss mindestens 8 Zeichen haben"),
  displayName: z.string().min(1).max(200),
  roles: z.array(roleNameSchema).optional(),
});

const setActiveSchema = z.object({ isActive: z.boolean() });
const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, "Passwort muss mindestens 8 Zeichen haben"),
});
const assignRoleSchema = z.object({ role: roleNameSchema });

export const adminUserRoutes = new Hono<{ Variables: AuthVariables }>();

adminUserRoutes.use("*", requireAuth(), requireRole("admin"));

adminUserRoutes.get("/", async (c) => {
  const list = await listUsers({ users });
  return c.json({ users: list });
});

adminUserRoutes.post("/", zValidator("json", createUserSchema), async (c) => {
  const input = c.req.valid("json");
  const actingUserId = c.get("auth").sub;
  const user = await createUser(
    {
      email: input.email,
      password: input.password,
      displayName: input.displayName,
      ...(input.roles ? { roles: input.roles as RoleName[] } : {}),
    },
    { users, roles, hasher, actingUserId },
  );
  return c.json({ user }, 201);
});

adminUserRoutes.post(
  "/:id/roles",
  zValidator("json", assignRoleSchema),
  async (c) => {
    const userId = c.req.param("id");
    const { role } = c.req.valid("json");
    const actingUserId = c.get("auth").sub;
    await assignRole({ userId, roleName: role }, { users, roles, actingUserId });
    return c.json({ ok: true });
  },
);

adminUserRoutes.delete("/:id/roles/:role", async (c) => {
  const userId = c.req.param("id");
  const roleParam = c.req.param("role");
  const parsed = roleNameSchema.safeParse(roleParam);
  if (!parsed.success) {
    return c.json({ error: { code: "INVALID_ROLE", message: "Unbekannte Rolle" } }, 400);
  }
  const actingUserId = c.get("auth").sub;
  await removeRole({ userId, roleName: parsed.data }, { users, roles, actingUserId });
  return c.json({ ok: true });
});

adminUserRoutes.patch(
  "/:id/active",
  zValidator("json", setActiveSchema),
  async (c) => {
    const userId = c.req.param("id");
    const { isActive } = c.req.valid("json");
    const actingUserId = c.get("auth").sub;
    await setUserActive({ userId, isActive }, { users, actingUserId });
    return c.json({ ok: true });
  },
);

adminUserRoutes.post(
  "/:id/password",
  zValidator("json", resetPasswordSchema),
  async (c) => {
    const userId = c.req.param("id");
    const { newPassword } = c.req.valid("json");
    const actingUserId = c.get("auth").sub;
    await resetUserPassword({ userId, newPassword }, { users, hasher, actingUserId });
    return c.json({ ok: true });
  },
);
