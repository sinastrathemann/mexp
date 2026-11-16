import { zValidator } from "@hono/zod-validator";
import { getHubUser } from "@mexp/auth";
import { Hono } from "hono";
import { z } from "zod";
import {
  EVENT_KINDS,
  type EventPlanMeta,
  GOAL_RESULTS,
  RECURRENCES,
  TEAM_ROLES,
  eventPlanMetaStore,
} from "../project-plan/model.js";
import { mexpUserStore, requireMexpRole } from "./_user-resolution.js";
import { teamMember } from "./event-tasks.js";

export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum im Format JJJJ-MM-TT.");

const putSchema = z
  .object({
    responsibleId: z.string().min(1).nullable().optional(),
    exmNote: z.string().max(5000).nullable().optional(),
    kind: z.enum(EVENT_KINDS).optional(),
    targetCount: z.string().trim().max(100).nullable().optional(),
    targetCategories: z.array(z.number().int().min(1).max(3)).max(3).optional(),
    recurrence: z.enum(RECURRENCES).nullable().optional(),
    goalReached: z.enum(GOAL_RESULTS).nullable().optional(),
    alternativeDate: isoDateSchema.nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Leeres Update." });

export function planMetaDto(meta: EventPlanMeta | undefined) {
  const responsibleId = meta?.responsibleId ?? null;
  const user = responsibleId ? mexpUserStore.get(responsibleId) : undefined;
  return {
    responsibleId,
    responsibleName: user ? (user.displayName ?? user.email ?? user.id) : null,
    exmNote: meta?.exmNote ?? null,
    kind: meta?.kind ?? "event",
    targetCount: meta?.targetCount ?? null,
    targetCategories: meta?.targetCategories ?? [],
    recurrence: meta?.recurrence ?? null,
    goalReached: meta?.goalReached ?? null,
    alternativeDate: meta?.alternativeDate ?? null,
  };
}

/** Nimmt den Wert aus dem Update, sonst den gespeicherten, sonst den Default. */
function pick<T>(input: T | undefined, current: T | undefined, fallback: T): T {
  if (input !== undefined) return input;
  return current !== undefined ? current : fallback;
}

// Plan-Meta je Event (Verantwortlich, EXM-Notiz, Event/Projekt, Planungsfelder). Nur für das
// Event-Team (EXM) lesbar und schreibbar — bewusst nicht Teil von GET /events/:id.
export const eventPlanMetaRoutes = new Hono();

eventPlanMetaRoutes.get("/events/:eventId/plan-meta", requireMexpRole(...TEAM_ROLES), (c) =>
  c.json({ meta: planMetaDto(eventPlanMetaStore.get(c.req.param("eventId"))) }),
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
    const target = input.targetCount === undefined ? undefined : input.targetCount?.trim() || null;
    const categories = input.targetCategories
      ? [...new Set(input.targetCategories)].sort((a, b) => a - b)
      : undefined;
    const next: EventPlanMeta = {
      responsibleId: pick(input.responsibleId, current?.responsibleId, null),
      exmNote: pick(note, current?.exmNote, null),
      kind: pick(input.kind, current?.kind, "event"),
      targetCount: pick(target, current?.targetCount, null),
      targetCategories: pick(categories, current?.targetCategories, []),
      recurrence: pick(input.recurrence, current?.recurrence, null),
      goalReached: pick(input.goalReached, current?.goalReached, null),
      alternativeDate: pick(input.alternativeDate, current?.alternativeDate, null),
      updatedBy: getHubUser(c).id,
      updatedAt: new Date().toISOString(),
    };
    eventPlanMetaStore.set(eventId, next);
    return c.json({ meta: planMetaDto(next) });
  },
);
