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

  // Dev-Mode: Akzeptiere Test-Credentials
  const DEV_USERS: Record<string, { id: string; displayName: string; roles: string[] }> = {
    "sina.strathemann@mindsquare.de": {
      id: "550e8400-e29b-41d4-a716-446655440000",
      displayName: "Sina (Dev)",
      roles: ["admin"],
    },
    "max.mustermann@mindsquare.de": {
      id: "550e8400-e29b-41d4-a716-446655440001",
      displayName: "Max Mustermann",
      roles: ["participant"],
    },
    "lisa.werkstudi@mindsquare.de": {
      id: "550e8400-e29b-41d4-a716-446655440002",
      displayName: "Lisa (Werkstudentin)",
      roles: ["werkstudent"],
    },
  };

  if (env.NODE_ENV === "development" && DEV_USERS[email] && password === "password") {
    const u = DEV_USERS[email];
    const token = await signSession(
      { sub: u.id, email, roles: u.roles },
      env.AUTH_JWT_SECRET,
      env.AUTH_SESSION_MAX_AGE_SECONDS,
    );
    setCookie(c, env.AUTH_SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "Lax",
      secure: false,
      path: "/",
      maxAge: env.AUTH_SESSION_MAX_AGE_SECONDS,
    });
    return c.json({
      user: {
        id: u.id,
        email,
        displayName: u.displayName,
        roles: u.roles,
      },
    });
  }

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

  // Dev-Mode: Return mock user
  if (env.NODE_ENV === "development") {
    const DEV_NAMES: Record<string, string> = {
      "550e8400-e29b-41d4-a716-446655440000": "Sina (Dev)",
      "550e8400-e29b-41d4-a716-446655440001": "Max Mustermann",
      "550e8400-e29b-41d4-a716-446655440002": "Lisa (Werkstudentin)",
    };
    if (DEV_NAMES[session.sub]) {
      return c.json({
        user: {
          id: session.sub,
          email: session.email,
          displayName: DEV_NAMES[session.sub],
          isActive: true,
          roles: session.roles,
          lastLoginAt: new Date().toISOString(),
        },
      });
    }
  }

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
