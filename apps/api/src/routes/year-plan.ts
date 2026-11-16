/**
 * Jahresplanung (Feedback-Runde 5, ersetzt den OneNote-„Projektplan"). Liefert für ein Jahr:
 * interne Events/Projekte aus mEXP (nur gelesen, mit Plan-Meta), manuell eingetragene externe
 * Termine/Ferien und berechnete NRW-Feiertage. Nur für TEAM_ROLES.
 */
import { randomUUID } from "node:crypto";
import { zValidator } from "@hono/zod-validator";
import { getHubUser } from "@mexp/auth";
import { Hono } from "hono";
import { z } from "zod";
import { persistentMap } from "../dev-persistence.js";
import { nrwHolidays } from "../project-plan/holidays.js";
import { TEAM_ROLES, eventPlanMetaStore } from "../project-plan/model.js";
import { requireMexpRole } from "./_user-resolution.js";
import { isoDateSchema, planMetaDto } from "./event-plan-meta.js";
import {
  applyOverride,
  devEventOverrideStore,
  isEventArchived,
  listDevBaseEvents,
} from "./events.js";

export const YEAR_PLAN_KINDS = ["external", "school_holiday"] as const;

export interface YearPlanEntry {
  id: string;
  kind: (typeof YEAR_PLAN_KINDS)[number];
  title: string;
  date: string;
  endDate: string | null;
  createdBy: string;
  createdAt: string;
}

export const yearPlanStore = persistentMap<YearPlanEntry>("year-plan-entries");

const createSchema = z
  .object({
    kind: z.enum(YEAR_PLAN_KINDS),
    title: z.string().trim().min(1).max(300),
    date: isoDateSchema,
    endDate: isoDateSchema.nullable().optional(),
  })
  .refine((v) => !v.endDate || v.endDate >= v.date, {
    message: "Ende darf nicht vor dem Beginn liegen.",
  });

const yearQuery = z.object({ year: z.coerce.number().int().min(2000).max(2100) });

function overlapsYear(start: string, end: string | null, year: number) {
  const y = String(year);
  return start.slice(0, 4) <= y && (end ?? start).slice(0, 4) >= y;
}

export const yearPlanRoutes = new Hono();

yearPlanRoutes.get(
  "/year-plan",
  requireMexpRole(...TEAM_ROLES),
  zValidator("query", yearQuery),
  (c) => {
    const { year } = c.req.valid("query");

    const internal = listDevBaseEvents()
      .map(applyOverride)
      .filter((e) => (e as { _deleted?: boolean })._deleted !== true)
      .map((e) => {
        const rec = e as unknown as {
          id: string;
          title: string;
          startAt?: string | null;
          endAt?: string | null;
          status?: string;
          eventType?: string;
          ownerId?: string;
        };
        const meta = planMetaDto(eventPlanMetaStore.get(rec.id));
        return {
          id: rec.id,
          title: rec.title,
          date: rec.startAt ? rec.startAt.slice(0, 10) : null,
          endDate: rec.endAt ? rec.endAt.slice(0, 10) : null,
          status: rec.status ?? null,
          eventType: rec.eventType ?? null,
          ownerId: rec.ownerId ?? null,
          archived: isEventArchived(rec.id, devEventOverrideStore.get(rec.id)),
          ...meta,
          // Notiz gehört in die Event-Ansicht, nicht in die Jahresübersicht.
          exmNote: undefined,
        };
      })
      .filter(
        (e) =>
          (e.date !== null && overlapsYear(e.date, e.endDate, year)) ||
          e.alternativeDate?.startsWith(String(year)) === true,
      );

    const manual = [...yearPlanStore.values()]
      .filter((e) => overlapsYear(e.date, e.endDate, year))
      .map(({ createdBy: _by, createdAt: _at, ...rest }) => rest);

    return c.json({ year, internal, manual, holidays: nrwHolidays(year) });
  },
);

yearPlanRoutes.post(
  "/year-plan/entries",
  requireMexpRole(...TEAM_ROLES),
  zValidator("json", createSchema),
  (c) => {
    const input = c.req.valid("json");
    const entry: YearPlanEntry = {
      id: randomUUID(),
      kind: input.kind,
      title: input.title,
      date: input.date,
      endDate: input.endDate ?? null,
      createdBy: getHubUser(c).id,
      createdAt: new Date().toISOString(),
    };
    yearPlanStore.set(entry.id, entry);
    const { createdBy: _by, createdAt: _at, ...dto } = entry;
    return c.json({ entry: dto }, 201);
  },
);

yearPlanRoutes.delete("/year-plan/entries/:id", requireMexpRole(...TEAM_ROLES), (c) => {
  if (!yearPlanStore.delete(c.req.param("id"))) {
    return c.json({ error: { code: "NOT_FOUND", message: "Eintrag nicht gefunden." } }, 404);
  }
  return c.body(null, 204);
});
