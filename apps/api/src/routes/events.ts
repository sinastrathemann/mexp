import { zValidator } from "@hono/zod-validator";
import {
  checkInParticipant,
  createEvent,
  getEvent,
  getOwnParticipation,
  listEvents,
  listParticipants,
  markNoShow,
  promoteFromWaitlist,
  registerForEvent,
  transitionEventStatus,
  updateEvent,
  withdrawFromEvent,
} from "@memp/application";
import { type AuthVariables, requireAuth, requireRole } from "@memp/auth";
import { EVENT_STATUSES, EVENT_TYPES, EVENT_VISIBILITIES } from "@memp/domain";
import { Hono } from "hono";
import { z } from "zod";
import { events, audit, participations } from "../deps.js";

const eventTypeSchema = z.enum(EVENT_TYPES);
const eventVisibilitySchema = z.enum(EVENT_VISIBILITIES);
const eventStatusSchema = z.enum(EVENT_STATUSES);
const isoDateSchema = z.string().datetime({ offset: true });

const createEventSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).default(""),
  eventType: eventTypeSchema,
  visibility: eventVisibilitySchema.default("internal"),
  startAt: isoDateSchema,
  endAt: isoDateSchema,
  location: z.string().max(500).nullable().default(null),
  capacity: z.number().int().positive().nullable().default(null),
});

const updateEventSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(5000).optional(),
    eventType: eventTypeSchema.optional(),
    visibility: eventVisibilitySchema.optional(),
    startAt: isoDateSchema.optional(),
    endAt: isoDateSchema.optional(),
    location: z.string().max(500).nullable().optional(),
    capacity: z.number().int().positive().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Mindestens ein Feld muss gesetzt sein" });

const transitionSchema = z.object({ status: eventStatusSchema });

const listQuerySchema = z.object({
  status: eventStatusSchema.optional(),
  mine: z.enum(["true", "false"]).optional(),
});

const WRITE_ROLES = ["admin", "manager", "event_office"] as const;

export const eventRoutes = new Hono<{ Variables: AuthVariables }>();

eventRoutes.use("*", requireAuth());

eventRoutes.get("/", zValidator("query", listQuerySchema), async (c) => {
  const q = c.req.valid("query");
  const session = c.get("auth");
  const filter: { status?: (typeof EVENT_STATUSES)[number]; ownerId?: string } = {};
  if (q.status) filter.status = q.status;
  if (q.mine === "true") filter.ownerId = session.sub;
  const list = await listEvents(filter, { events });
  return c.json({ events: list });
});

eventRoutes.post(
  "/",
  requireRole(...WRITE_ROLES),
  zValidator("json", createEventSchema),
  async (c) => {
    const input = c.req.valid("json");
    const actorId = c.get("auth").sub;
    const event = await createEvent(
      {
        title: input.title,
        description: input.description,
        eventType: input.eventType,
        visibility: input.visibility,
        startAt: new Date(input.startAt),
        endAt: new Date(input.endAt),
        location: input.location,
        capacity: input.capacity,
        ownerId: actorId,
      },
      actorId,
      { events, audit },
    );
    return c.json({ event }, 201);
  },
);

eventRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const event = await getEvent(id, { events });
  return c.json({ event });
});

eventRoutes.patch(
  "/:id",
  requireRole(...WRITE_ROLES),
  zValidator("json", updateEventSchema),
  async (c) => {
    const id = c.req.param("id");
    const input = c.req.valid("json");
    const actorId = c.get("auth").sub;
    const patch: Parameters<typeof updateEvent>[1] = {};
    if (input.title !== undefined) patch.title = input.title;
    if (input.description !== undefined) patch.description = input.description;
    if (input.eventType !== undefined) patch.eventType = input.eventType;
    if (input.visibility !== undefined) patch.visibility = input.visibility;
    if (input.startAt !== undefined) patch.startAt = new Date(input.startAt);
    if (input.endAt !== undefined) patch.endAt = new Date(input.endAt);
    if (input.location !== undefined) patch.location = input.location;
    if (input.capacity !== undefined) patch.capacity = input.capacity;
    const event = await updateEvent(id, patch, actorId, { events, audit });
    return c.json({ event });
  },
);

eventRoutes.patch(
  "/:id/status",
  requireRole(...WRITE_ROLES),
  zValidator("json", transitionSchema),
  async (c) => {
    const id = c.req.param("id");
    const { status } = c.req.valid("json");
    const actorId = c.get("auth").sub;
    const event = await transitionEventStatus(id, status, actorId, { events, audit });
    return c.json({ event });
  },
);

eventRoutes.get("/:id/my-participation", async (c) => {
  const id = c.req.param("id");
  const actorId = c.get("auth").sub;
  const participation = await getOwnParticipation(id, actorId, { events, participations });
  return c.json({ participation });
});

eventRoutes.get("/:id/participants", requireRole(...WRITE_ROLES), async (c) => {
  const id = c.req.param("id");
  const list = await listParticipants(id, { events, participations });
  return c.json({ participants: list });
});

eventRoutes.get("/:id/participants.csv", requireRole(...WRITE_ROLES), async (c) => {
  const id = c.req.param("id");
  const list = await listParticipants(id, { events, participations });
  const header = [
    "userId",
    "displayName",
    "email",
    "status",
    "waitlistPosition",
    "registeredAt",
    "checkedInAt",
    "cancelledAt",
  ].join(",");
  const lines = list.map((p) =>
    [
      p.userId,
      csvEscape(p.userDisplayName),
      csvEscape(p.userEmail),
      p.status,
      p.waitlistPosition ?? "",
      p.registeredAt.toISOString(),
      p.checkedInAt ? p.checkedInAt.toISOString() : "",
      p.cancelledAt ? p.cancelledAt.toISOString() : "",
    ].join(","),
  );
  const csv = `${header}\n${lines.join("\n")}\n`;
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="event-${id}-participants.csv"`,
    },
  });
});

eventRoutes.get("/:id/emergency-list", requireRole(...WRITE_ROLES), async (c) => {
  const id = c.req.param("id");
  const event = await getEvent(id, { events });
  const list = await listParticipants(id, { events, participations });
  const active = list.filter((p) => p.status === "registered" || p.status === "attended");
  return c.json({
    event: {
      id: event.id,
      title: event.title,
      startAt: event.startAt,
      endAt: event.endAt,
      location: event.location,
    },
    generatedAt: new Date().toISOString(),
    count: active.length,
    participants: active.map((p) => ({
      displayName: p.userDisplayName,
      email: p.userEmail,
      status: p.status,
      checkedInAt: p.checkedInAt,
    })),
  });
});

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

eventRoutes.post("/:id/register", async (c) => {
  const id = c.req.param("id");
  const actorId = c.get("auth").sub;
  const participation = await registerForEvent({ eventId: id, userId: actorId }, actorId, {
    events,
    participations,
    audit,
  });
  return c.json({ participation }, 201);
});

eventRoutes.post("/:id/withdraw", async (c) => {
  const id = c.req.param("id");
  const actorId = c.get("auth").sub;
  const participation = await withdrawFromEvent({ eventId: id, userId: actorId }, actorId, {
    events,
    participations,
    audit,
  });
  return c.json({ participation });
});

eventRoutes.post("/:id/participants/promote-waitlist", requireRole(...WRITE_ROLES), async (c) => {
  const id = c.req.param("id");
  const actorId = c.get("auth").sub;
  const participation = await promoteFromWaitlist(id, actorId, {
    events,
    participations,
    audit,
  });
  return c.json({ participation });
});

eventRoutes.post(
  "/:eventId/participants/:participationId/check-in",
  requireRole(...WRITE_ROLES),
  async (c) => {
    const participationId = c.req.param("participationId");
    const actorId = c.get("auth").sub;
    const participation = await checkInParticipant(participationId, actorId, {
      events,
      participations,
      audit,
    });
    return c.json({ participation });
  },
);

eventRoutes.post(
  "/:eventId/participants/:participationId/no-show",
  requireRole(...WRITE_ROLES),
  async (c) => {
    const participationId = c.req.param("participationId");
    const actorId = c.get("auth").sub;
    const participation = await markNoShow(participationId, actorId, {
      events,
      participations,
      audit,
    });
    return c.json({ participation });
  },
);
