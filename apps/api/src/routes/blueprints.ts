import { zValidator } from "@hono/zod-validator";
import {
  applyBlueprint,
  createBlueprint,
  deleteBlueprint,
  listBlueprints,
  updateBlueprint,
} from "@memp/application";
import { type AuthVariables, requireAuth, requireRole } from "@memp/auth";
import { EVENT_TYPES, EVENT_VISIBILITIES } from "@memp/domain";
import { Hono } from "hono";
import { z } from "zod";
import { events, audit, blueprints } from "../deps.js";

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

export const blueprintRoutes = new Hono<{ Variables: AuthVariables }>();

blueprintRoutes.use("*", requireAuth());

blueprintRoutes.get("/", async (c) => {
  const list = await listBlueprints({ blueprints });
  return c.json({ blueprints: list });
});

blueprintRoutes.post(
  "/",
  requireRole(...WRITE_ROLES),
  zValidator("json", createSchema),
  async (c) => {
    const input = c.req.valid("json");
    const actorId = c.get("auth").sub;
    const blueprint = await createBlueprint(input, actorId, { blueprints, audit });
    return c.json({ blueprint }, 201);
  },
);

blueprintRoutes.patch(
  "/:id",
  requireRole(...WRITE_ROLES),
  zValidator("json", updateSchema),
  async (c) => {
    const id = c.req.param("id");
    const input = c.req.valid("json");
    const actorId = c.get("auth").sub;
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

blueprintRoutes.delete("/:id", requireRole(...WRITE_ROLES), async (c) => {
  const id = c.req.param("id");
  const actorId = c.get("auth").sub;
  await deleteBlueprint(id, actorId, { blueprints, audit });
  return c.json({ ok: true });
});

blueprintRoutes.post(
  "/:id/apply",
  requireRole(...WRITE_ROLES),
  zValidator("json", applySchema),
  async (c) => {
    const id = c.req.param("id");
    const input = c.req.valid("json");
    const actorId = c.get("auth").sub;
    const event = await applyBlueprint(
      { blueprintId: id, title: input.title, startAt: new Date(input.startAt) },
      actorId,
      { blueprints, events, audit },
    );
    return c.json({ event }, 201);
  },
);
