/**
 * Contentplan (Feedback-Runde 5): geplante Kommunikation des EXM-Teams — was, wann, über
 * welchen Kanal, wer. Optional mit einem Event/Projekt verknüpft. Nur für TEAM_ROLES;
 * eigener Store, Event-Datensätze bleiben unberührt.
 */
import { randomUUID } from "node:crypto";
import { zValidator } from "@hono/zod-validator";
import { getHubUser } from "@mexp/auth";
import { Hono } from "hono";
import { z } from "zod";
import { persistentMap } from "../dev-persistence.js";
import { TEAM_ROLES } from "../project-plan/model.js";
import { mexpUserStore, requireMexpRole } from "./_user-resolution.js";
import { isoDateSchema } from "./event-plan-meta.js";
import { teamMember } from "./event-tasks.js";

export const CONTENT_CHANNELS = [
  "general",
  "mail",
  "teams",
  "outlook",
  "communities",
  "location",
  "other",
] as const;

export interface ContentPlanEntry {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  channel: (typeof CONTENT_CHANNELS)[number];
  responsibleId: string | null;
  eventId: string | null;
  note: string | null;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
}

export const contentPlanStore = persistentMap<ContentPlanEntry>("content-plan");

const baseSchema = z.object({
  date: isoDateSchema,
  title: z.string().trim().min(1).max(300),
  channel: z.enum(CONTENT_CHANNELS),
  responsibleId: z.string().min(1).nullable().optional(),
  eventId: z.string().min(1).max(200).nullable().optional(),
  note: z.string().trim().max(2000).nullable().optional(),
});
const patchSchema = baseSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Leeres Update." });
const listQuery = z.object({
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  eventId: z.string().optional(),
});

function toDto(e: ContentPlanEntry) {
  const user = e.responsibleId ? mexpUserStore.get(e.responsibleId) : undefined;
  return {
    id: e.id,
    date: e.date,
    title: e.title,
    channel: e.channel,
    responsibleId: e.responsibleId,
    responsibleName: user ? (user.displayName ?? user.email ?? user.id) : null,
    eventId: e.eventId,
    note: e.note,
  };
}

const invalidResponsible = {
  error: { code: "INVALID_RESPONSIBLE", message: "Diese Person gehört nicht zum Event-Team." },
};
const notFound = { error: { code: "NOT_FOUND", message: "Eintrag nicht gefunden." } };

export const contentPlanRoutes = new Hono();

contentPlanRoutes.get(
  "/content-plan",
  requireMexpRole(...TEAM_ROLES),
  zValidator("query", listQuery),
  (c) => {
    const { from, to, eventId } = c.req.valid("query");
    const entries = [...contentPlanStore.values()]
      .filter((e) => (from ? e.date >= from : true))
      .filter((e) => (to ? e.date <= to : true))
      .filter((e) => (eventId ? e.eventId === eventId : true))
      .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
      .map(toDto);
    return c.json({ entries });
  },
);

contentPlanRoutes.post(
  "/content-plan",
  requireMexpRole(...TEAM_ROLES),
  zValidator("json", baseSchema),
  (c) => {
    const input = c.req.valid("json");
    if (input.responsibleId && !teamMember(input.responsibleId)) {
      return c.json(invalidResponsible, 400);
    }
    const actor = getHubUser(c).id;
    const now = new Date().toISOString();
    const entry: ContentPlanEntry = {
      id: randomUUID(),
      date: input.date,
      title: input.title,
      channel: input.channel,
      responsibleId: input.responsibleId ?? null,
      eventId: input.eventId ?? null,
      note: input.note || null,
      createdBy: actor,
      createdAt: now,
      updatedBy: actor,
      updatedAt: now,
    };
    contentPlanStore.set(entry.id, entry);
    return c.json({ entry: toDto(entry) }, 201);
  },
);

contentPlanRoutes.patch(
  "/content-plan/:id",
  requireMexpRole(...TEAM_ROLES),
  zValidator("json", patchSchema),
  (c) => {
    const current = contentPlanStore.get(c.req.param("id"));
    if (!current) return c.json(notFound, 404);
    const input = c.req.valid("json");
    if (input.responsibleId && !teamMember(input.responsibleId)) {
      return c.json(invalidResponsible, 400);
    }
    const next: ContentPlanEntry = {
      ...current,
      date: input.date ?? current.date,
      title: input.title ?? current.title,
      channel: input.channel ?? current.channel,
      responsibleId:
        input.responsibleId === undefined ? current.responsibleId : input.responsibleId,
      eventId: input.eventId === undefined ? current.eventId : input.eventId,
      note: input.note === undefined ? current.note : input.note || null,
      updatedBy: getHubUser(c).id,
      updatedAt: new Date().toISOString(),
    };
    contentPlanStore.set(next.id, next);
    return c.json({ entry: toDto(next) });
  },
);

contentPlanRoutes.delete("/content-plan/:id", requireMexpRole(...TEAM_ROLES), (c) => {
  if (!contentPlanStore.delete(c.req.param("id"))) return c.json(notFound, 404);
  return c.body(null, 204);
});
