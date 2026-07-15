import { getPortfolioStats } from "@memp/application";
import { Hono } from "hono";
import { dashboard, env } from "../deps.js";

export const dashboardRoutes = new Hono();

dashboardRoutes.get("/portfolio", async (c) => {
  // Dev-Mode: Return mock stats
  if (!env.DATABASE_URL) {
    return c.json({
      stats: {
        eventsByStatus: {
          draft: 2,
          planned: 5,
          open: 3,
          running: 1,
          closed: 8,
          cancelled: 0,
        },
        participationByStatus: {
          registered: 45,
          waitlisted: 12,
          attended: 38,
          no_show: 3,
        },
        upcomingEventsCount: 9,
        attendanceRate: 0.92,
        noShowRate: 0.08,
        totalEvents: 19,
      },
    });
  }

  const stats = await getPortfolioStats({ dashboard });
  return c.json({ stats });
});
