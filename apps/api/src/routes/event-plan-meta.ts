import { zValidator } from "@hono/zod-validator";
import { getHubUser } from "@mexp/auth";
import { Hono } from "hono";
import { z } from "zod";
import { type EventPlanMeta, TEAM_ROLES, eventPlanMetaStore } from "../project-plan/model.js";
import { mexpUserStore, requireMexpRole } from "./_user-resolution.js";
import { teamMember } from "./event-tasks.js";

const putSchema = z
  .object({
    responsibleId: z.string().min(1).nullable().optional(),
    exmNote: z.string().max(5000).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Leeres Update." });

function toDto(meta: EventPlanMeta | undefined) {
  const responsibleId = meta?.responsibleId ?? null;
  const user = responsibleId ? mexpUserStore.get(responsibleId) : undefined;
  return {
    responsibleId,
    responsibleName: user ? (user.displayName ?? user.email ?? user.id) : null,
    exmNote: meta?.exmNote ?? null,
  };
}

// Verantwortliche/r + EXM-Notiz je Event. Nur für das Event-Team (EXM) lesbar und
// schreibbar — die Notiz ist bewusst nicht Teil von GET /events/:id.
export const eventPlanMetaRoutes = new Hono();

eventPlanMetaRoutes.get("/events/:eventId/plan-meta", requireMexpRole(...TEAM_ROLES), (c) =>
  c.json({ meta: toDto(eventPlanMetaStore.get(c.req.param("eventId"))) }),
);

eventPlanMetaRoutes.put(
  "/events/:eventId/plan-meta",
  requireMexpRole(...TEAM_ROLES),
  zValidator("json", putSchema),
  (c) => {
    const eventId = c.req.param("eventId");
    const input = c.req.valid("json");
    if (input.responsibleId && !teamMember(input.responsibleId)) {
      return c.json(
        {
          error: {
            code: "INVALID_RESPONSIBLE",
            message: "Diese Person gehört nicht zum Event-Team.",
          },
        },
        400,
      );
    }
    const current = eventPlanMetaStore.get(eventId);
    const note = input.exmNote === undefined ? undefined : input.exmNote?.trim() || null;
    const next: EventPlanMeta = {
      responsibleId:
        input.responsibleId === undefined ? (current?.responsibleId ?? null) : input.responsibleId,
      exmNote: note === undefined ? (current?.exmNote ?? null) : note,
      updatedBy: getHubUser(c).id,
      updatedAt: new Date().toISOString(),
    };
    eventPlanMetaStore.set(eventId, next);
    return c.json({ meta: toDto(next) });
  },
);
