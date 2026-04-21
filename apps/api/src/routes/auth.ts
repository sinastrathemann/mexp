import { zValidator } from "@hono/zod-validator";
import { loginUser } from "@memp/application";
import { type AuthVariables, requireAuth, signSession } from "@memp/auth";
import { Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import { env, hasher, users } from "../deps.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const authRoutes = new Hono<{ Variables: AuthVariables }>();

authRoutes.post("/login", zValidator("json", loginSchema), async (c) => {
  const { email, password } = c.req.valid("json");
  const user = await loginUser({ email, password }, { users, hasher });

  const token = await signSession(
    { sub: user.id, email: user.email, roles: user.roles },
    env.AUTH_JWT_SECRET,
    env.AUTH_SESSION_MAX_AGE_SECONDS,
  );

  setCookie(c, env.AUTH_SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "Lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: env.AUTH_SESSION_MAX_AGE_SECONDS,
  });

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      roles: user.roles,
    },
  });
});

authRoutes.post("/logout", (c) => {
  deleteCookie(c, env.AUTH_SESSION_COOKIE_NAME, { path: "/" });
  return c.json({ ok: true });
});

authRoutes.get("/me", requireAuth(), async (c) => {
  const session = c.get("auth");
  const user = await users.findById(session.sub);
  if (!user) {
    deleteCookie(c, env.AUTH_SESSION_COOKIE_NAME, { path: "/" });
    return c.json({ error: { code: "USER_NOT_FOUND", message: "Benutzer nicht gefunden" } }, 404);
  }
  return c.json({
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      isActive: user.isActive,
      roles: user.roles,
      lastLoginAt: user.lastLoginAt,
    },
  });
});
