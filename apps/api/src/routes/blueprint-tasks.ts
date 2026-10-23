import { randomUUID } from "node:crypto";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import {
  type BlueprintTask,
  TEAM_ROLES,
  blueprintTaskStore,
  httpsUrlSchema,
  linkLabelSchema,
  taskTitleSchema,
} from "../project-plan/model.js";
import { requireMexpRole } from "./_user-resolution.js";

const putSchema = z.object({
  tasks: z
    .array(
      z
        .object({
          id: z.string().min(1).max(100).optional(),
          title: taskTitleSchema,
          daysBefore: z.number().int().min(0).max(365).nullable(),
          linkLabel: linkLabelSchema.nullable(),
          linkUrl: httpsUrlSchema.nullable(),
        })
        .refine((t) => (t.linkLabel === null) === (t.linkUrl === null), {
          message: "Link braucht Text und https-URL.",
          path: ["linkUrl"],
        }),
    )
    .max(100),
});

const notFound = { error: { code: "BLUEPRINT_NOT_FOUND", message: "Blueprint nicht gefunden" } };

/**
 * Aufgaben-Vorlagen je Blueprint. Die Existenzprüfung wird injiziert, damit das Modul
 * ohne deps.ts (Postgres/LLM) testbar bleibt — blueprints.ts reicht die echte Prüfung rein.
 */
export function createBlueprintTaskRoutes(blueprintExists: (id: string) => Promise<boolean>) {
  const routes = new Hono();

  routes.get("/:id/tasks", requireMexpRole(...TEAM_ROLES), async (c) => {
    const id = c.req.param("id");
    if (!(await blueprintExists(id))) return c.json(notFound, 404);
    return c.json({ tasks: blueprintTaskStore.get(id) ?? [] });
  });

  routes.put(
    "/:id/tasks",
    requireMexpRole(...TEAM_ROLES),
    zValidator("json", putSchema),
    async (c) => {
      const id = c.req.param("id");
      if (!(await blueprintExists(id))) return c.json(notFound, 404);
      const tasks: BlueprintTask[] = c.req.valid("json").tasks.map((t) => ({
        id: t.id ?? randomUUID(),
        title: t.title,
        daysBefore: t.daysBefore,
        linkLabel: t.linkLabel,
        linkUrl: t.linkUrl,
      }));
      blueprintTaskStore.set(id, tasks);
      return c.json({ tasks });
    },
  );

  return routes;
}
