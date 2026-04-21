import { getPortfolioStats } from "@memp/application";
import { type AuthVariables, requireAuth } from "@memp/auth";
import { Hono } from "hono";
import { dashboard } from "../deps.js";

export const dashboardRoutes = new Hono<{ Variables: AuthVariables }>();

dashboardRoutes.use("*", requireAuth());

dashboardRoutes.get("/portfolio", async (c) => {
  const stats = await getPortfolioStats({ dashboard });
  return c.json({ stats });
});
