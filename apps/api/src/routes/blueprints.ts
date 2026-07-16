import { randomUUID } from "node:crypto";
import { zValidator } from "@hono/zod-validator";
import {
  applyBlueprint,
  createBlueprint,
  deleteBlueprint,
  listBlueprints,
  updateBlueprint,
} from "@mexp/application";
import { getHubUser } from "@mexp/auth";
import { EVENT_TYPES, EVENT_VISIBILITIES } from "@mexp/domain";
import { Hono } from "hono";
import { z } from "zod";
import { events, audit, blueprints, env } from "../deps.js";
import { persistentMap } from "../dev-persistence.js";
import { requireMexpRole } from "./_user-resolution.js";
import { createDevEvent } from "./events.js";

const eventTypeSchema = z.enum(EVENT_TYPES);
const visibilitySchema = z.enum(EVENT_VISIBILITIES);

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).default(""),
  eventType: eventTypeSchema,
  visibility: visibilitySchema.default("internal"),
  defaultDurationMinutes: z
    .number()
    .int()
    .positive()
    .max(60 * 24 * 30),
  defaultCapacity: z.number().int().positive().nullable().default(null),
  defaultLocation: z.string().max(500).nullable().default(null),
  defaultDescription: z.string().max(5000).default(""),
});

const updateSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional(),
    eventType: eventTypeSchema.optional(),
    visibility: visibilitySchema.optional(),
    defaultDurationMinutes: z
      .number()
      .int()
      .positive()
      .max(60 * 24 * 30)
      .optional(),
    defaultCapacity: z.number().int().positive().nullable().optional(),
    defaultLocation: z.string().max(500).nullable().optional(),
    defaultDescription: z.string().max(5000).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Mindestens ein Feld muss gesetzt sein" });

const applySchema = z.object({
  title: z.string().min(1).max(200),
  startAt: z.string().datetime({ offset: true }),
});

const WRITE_ROLES = ["admin", "manager", "event_office", "werkstudent"] as const;

// Dev-Mode (file-store — Design-Spec §3.4): voller Blueprint-CRUD-Store, analog zu
// tenders.ts. Persistiert in apps/api/data/blueprints.json — bleibt bei Neustarts erhalten.
export interface DevBlueprint {
  id: string;
  name: string;
  description: string;
  eventType: (typeof EVENT_TYPES)[number];
  visibility: (typeof EVENT_VISIBILITIES)[number];
  defaultDurationMinutes: number;
  defaultCapacity: number | null;
  defaultLocation: string | null;
  defaultDescription: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

const devBlueprintStore = persistentMap<DevBlueprint>("blueprints");

export const blueprintRoutes = new Hono();

blueprintRoutes.get("/", async (c) => {
  if (!env.DATABASE_URL) {
    const list = Array.from(devBlueprintStore.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    return c.json({ blueprints: list });
  }
  const list = await listBlueprints({ blueprints });
  return c.json({ blueprints: list });
});

blueprintRoutes.post(
  "/",
  requireMexpRole(...WRITE_ROLES),
  zValidator("json", createSchema),
  async (c) => {
    const input = c.req.valid("json");
    const actorId = getHubUser(c).id;

    if (!env.DATABASE_URL) {
      const now = new Date().toISOString();
      const blueprint: DevBlueprint = {
        id: randomUUID(),
        name: input.name,
        description: input.description,
        eventType: input.eventType,
        visibility: input.visibility,
        defaultDurationMinutes: input.defaultDurationMinutes,
        defaultCapacity: input.defaultCapacity,
        defaultLocation: input.defaultLocation,
        defaultDescription: input.defaultDescription,
        createdBy: actorId,
        createdAt: now,
        updatedAt: now,
      };
      devBlueprintStore.set(blueprint.id, blueprint);
      return c.json({ blueprint }, 201);
    }

    const blueprint = await createBlueprint(input, actorId, { blueprints, audit });
    return c.json({ blueprint }, 201);
  },
);

blueprintRoutes.patch(
  "/:id",
  requireMexpRole(...WRITE_ROLES),
  zValidator("json", updateSchema),
  async (c) => {
    const id = c.req.param("id");
    const input = c.req.valid("json");
    const actorId = getHubUser(c).id;

    if (!env.DATABASE_URL) {
      const existing = devBlueprintStore.get(id);
      if (!existing) {
        return c.json({ error: { code: "NOT_FOUND", message: "Blueprint nicht gefunden" } }, 404);
      }
      const next: DevBlueprint = {
        ...existing,
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.eventType !== undefined && { eventType: input.eventType }),
        ...(input.visibility !== undefined && { visibility: input.visibility }),
        ...(input.defaultDurationMinutes !== undefined && {
          defaultDurationMinutes: input.defaultDurationMinutes,
        }),
        ...(input.defaultCapacity !== undefined && { defaultCapacity: input.defaultCapacity }),
        ...(input.defaultLocation !== undefined && { defaultLocation: input.defaultLocation }),
        ...(input.defaultDescription !== undefined && {
          defaultDescription: input.defaultDescription,
        }),
        updatedAt: new Date().toISOString(),
      };
      devBlueprintStore.set(id, next);
      return c.json({ blueprint: next });
    }

    const patch: Parameters<typeof updateBlueprint>[1] = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.description !== undefined) patch.description = input.description;
    if (input.eventType !== undefined) patch.eventType = input.eventType;
    if (input.visibility !== undefined) patch.visibility = input.visibility;
    if (input.defaultDurationMinutes !== undefined)
      patch.defaultDurationMinutes = input.defaultDurationMinutes;
    if (input.defaultCapacity !== undefined) patch.defaultCapacity = input.defaultCapacity;
    if (input.defaultLocation !== undefined) patch.defaultLocation = input.defaultLocation;
    if (input.defaultDescription !== undefined) patch.defaultDescription = input.defaultDescription;
    const blueprint = await updateBlueprint(id, patch, actorId, { blueprints, audit });
    return c.json({ blueprint });
  },
);

// Löschen nur Admin (Sina's Regel: Anlegen/Bearbeiten/Anwenden dürfen mehr Rollen, Löschen nicht).
blueprintRoutes.delete("/:id", requireMexpRole("admin"), async (c) => {
  const id = c.req.param("id");
  const actorId = getHubUser(c).id;

  if (!env.DATABASE_URL) {
    if (!devBlueprintStore.has(id)) {
      return c.json({ error: { code: "NOT_FOUND", message: "Blueprint nicht gefunden" } }, 404);
    }
    devBlueprintStore.delete(id);
    return c.json({ ok: true });
  }

  await deleteBlueprint(id, actorId, { blueprints, audit });
  return c.json({ ok: true });
});

blueprintRoutes.post(
  "/:id/apply",
  requireMexpRole(...WRITE_ROLES),
  zValidator("json", applySchema),
  async (c) => {
    const id = c.req.param("id");
    const input = c.req.valid("json");
    const actorId = getHubUser(c).id;

    if (!env.DATABASE_URL) {
      const blueprint = devBlueprintStore.get(id);
      if (!blueprint) {
        return c.json(
          { error: { code: "BLUEPRINT_NOT_FOUND", message: "Blueprint nicht gefunden" } },
          404,
        );
      }
      const startAt = new Date(input.startAt);
      const endAt = new Date(startAt.getTime() + blueprint.defaultDurationMinutes * 60_000);
      const event = createDevEvent({
        title: input.title,
        description: blueprint.defaultDescription,
        eventType: blueprint.eventType,
        visibility: blueprint.visibility,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        location: blueprint.defaultLocation,
        capacity: blueprint.defaultCapacity,
        ownerId: actorId,
      });
      return c.json({ event }, 201);
    }

    const event = await applyBlueprint(
      { blueprintId: id, title: input.title, startAt: new Date(input.startAt) },
      actorId,
      { blueprints, events, audit },
    );
    return c.json({ event }, 201);
  },
);
