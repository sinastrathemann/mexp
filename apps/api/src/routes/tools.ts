import { randomUUID } from "node:crypto";
import { zValidator } from "@hono/zod-validator";
import { getHubUser } from "@mexp/auth";
import { Hono } from "hono";
import { z } from "zod";
import {
  TEAM_ROLES,
  getTools,
  httpsUrlSchema,
  linkLabelSchema,
  toolStore,
} from "../project-plan/model.js";
import { requireMexpRole } from "./_user-resolution.js";

const putSchema = z.object({
  tools: z
    .array(
      z.object({
        id: z.string().min(1).max(100).optional(),
        label: linkLabelSchema,
        url: httpsUrlSchema,
      }),
    )
    .max(50),
});

// Zentrale Link-Liste externer Tools (Coworking-Copilot, Budget-Control-Agent, …).
export const toolRoutes = new Hono();

toolRoutes.get("/", requireMexpRole(...TEAM_ROLES), (c) => c.json({ tools: getTools() }));

toolRoutes.put("/", requireMexpRole("admin"), zValidator("json", putSchema), (c) => {
  const input = c.req.valid("json");
  const tools = input.tools.map((t) => ({ id: t.id ?? randomUUID(), label: t.label, url: t.url }));
  toolStore.set("default", {
    tools,
    updatedBy: getHubUser(c).id,
    updatedAt: new Date().toISOString(),
  });
  return c.json({ tools });
});
