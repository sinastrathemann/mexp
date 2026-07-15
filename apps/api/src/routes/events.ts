// Dev-mode persistence enabled
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
import { getHubUser } from "@memp/auth";
import { EVENT_STATUSES, EVENT_TYPES, EVENT_VISIBILITIES } from "@memp/domain";
import { Hono } from "hono";
import { z } from "zod";
import { events, audit, env, participations } from "../deps.js";
import { persistentMap } from "../dev-persistence.js";
import { requireMempRole, resolveMempRoles } from "./_user-resolution.js";
import {
  devAnswerStore,
  devFormStore,
  devLiveParticipantsStore,
  validateAnswers,
} from "./registration-form.js";

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
    locationDetails: z.string().max(5000).nullable().optional(),
    capacity: z.number().int().positive().nullable().optional(),
    registrationDeadline: isoDateSchema.nullable().optional(),
    audienceScope: z.enum(["all", "roles", "emails"]).optional(),
    audienceRoles: z.array(z.string().max(64)).max(20).optional(),
    audienceEmails: z.array(z.string().email()).max(200).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Mindestens ein Feld muss gesetzt sein" });

const transitionSchema = z.object({ status: eventStatusSchema });

const listQuerySchema = z.object({
  status: eventStatusSchema.optional(),
  mine: z.enum(["true", "false"]).optional(),
});

// Schreibrechte: anlegen + bearbeiten. Werkstudent dürfen mitarbeiten, aber NICHT löschen.
const WRITE_ROLES = ["admin", "manager", "event_office", "werkstudent"] as const;

// Dev-Mode: Override-Store für Events (eventId → Patch)
// Persistiert in apps/api/data/event-overrides.json — bleibt bei Neustarts erhalten
const devEventOverrideStore = persistentMap<Record<string, unknown>>("event-overrides");

function applyOverride<T extends { id: string }>(event: T): T {
  const ov = devEventOverrideStore.get(event.id);
  if (!ov) return event;
  return { ...event, ...ov };
}

function buildMockEventList() {
  const now = new Date();
  const inDays = (d: number) => new Date(now.getTime() + d * 86400000).toISOString();
  const ownerId = "550e8400-e29b-41d4-a716-446655440000";
  return [
    {
      id: "evt-001",
      title: "Code & Pizza — Frontend Night",
      description: "Lockerer Code-Abend rund um React, Vite und neue UI-Pattern.",
      eventType: "team",
      visibility: "internal",
      status: "open",
      startAt: inDays(7),
      endAt: inDays(7),
      location: "Bielefeld HQ",
      capacity: 20,
      ownerId,
      createdAt: inDays(-14),
      updatedAt: inDays(-1),
    },
    {
      id: "evt-002",
      title: "Sommerfest 2026",
      description: "Unser jährliches Betriebsfest — alle Standorte, ein Abend.",
      eventType: "mindsquare",
      visibility: "internal",
      status: "planned",
      startAt: inDays(45),
      endAt: inDays(45),
      location: "Heidewald",
      capacity: 150,
      ownerId,
      createdAt: inDays(-30),
      updatedAt: inDays(-3),
    },
    {
      id: "evt-003",
      title: "Q2 Strategie-Tag",
      description: "Strategieklausur der Geschäftsführung für die Q2-Planung.",
      eventType: "strategy",
      visibility: "internal",
      status: "running",
      startAt: inDays(-1),
      endAt: inDays(2),
      location: "Online",
      capacity: 30,
      ownerId,
      createdAt: inDays(-21),
      updatedAt: inDays(-1),
    },
    {
      id: "evt-004",
      title: "Onboarding Welcome Day",
      description: "Willkommenstag für neue Kolleg:innen — Tour, Tools, Team.",
      eventType: "office",
      visibility: "internal",
      status: "open",
      startAt: inDays(14),
      endAt: inDays(14),
      location: "Bielefeld HQ",
      capacity: 12,
      ownerId,
      createdAt: inDays(-10),
      updatedAt: inDays(-1),
    },
    {
      id: "evt-005",
      title: "Padel & Pizza Evening",
      description: "Feelgood-Abend: Padel-Plätze, Pizza und gute Laune.",
      eventType: "feelgood",
      visibility: "internal",
      status: "open",
      startAt: inDays(21),
      endAt: inDays(21),
      location: "Padelhaus Bielefeld",
      capacity: 24,
      ownerId,
      createdAt: inDays(-7),
      updatedAt: inDays(-1),
    },
    {
      id: "evt-006",
      title: "SAP Bereich All-Hands",
      description: "Quartalsupdate des SAP-Bereichs: Roadmap, Wins, Lessons Learned.",
      eventType: "division",
      visibility: "internal",
      status: "planned",
      startAt: inDays(28),
      endAt: inDays(28),
      location: "Online",
      capacity: 80,
      ownerId,
      createdAt: inDays(-12),
      updatedAt: inDays(-2),
    },
    {
      id: "evt-007",
      title: "Brauerei-Tour Bielefeld",
      description: "Local Experience: Führung durch eine ostwestfälische Hausbrauerei.",
      eventType: "local_experience",
      visibility: "internal",
      status: "draft",
      startAt: inDays(60),
      endAt: inDays(60),
      location: "Brauerei Joh. Albrecht",
      capacity: 18,
      ownerId,
      createdAt: inDays(-2),
      updatedAt: inDays(-1),
    },
  ];
}

export const eventRoutes = new Hono();

eventRoutes.get("/", zValidator("query", listQuerySchema), async (c) => {
  if (!env.DATABASE_URL) {
    const baseEvents = buildMockEventList();
    const user = getHubUser(c);
    const userRoles = resolveMempRoles(c);
    const userEmail = (user.email ?? "").toLowerCase();
    // Rollen, die Events managen (alle Status sehen): admin, manager, event_office, budget_owner, werkstudent
    const isPrivilegedRole = userRoles.some((r) =>
      ["admin", "manager", "event_office", "budget_owner", "werkstudent"].includes(r),
    );
    // Nicht-privilegierte User (Teilnehmer/Read-Only) sehen nur diese Status:
    const VISIBLE_STATUSES_FOR_PARTICIPANT = new Set(["planned", "open", "running"]);

    const events = baseEvents
      .map(applyOverride)
      .filter((e) => (e as unknown as { _deleted?: boolean })._deleted !== true)
      // Status-Filter: Teilnehmer sehen nur geplant/anmeldung-offen/läuft
      .filter((e) => {
        if (isPrivilegedRole) return true;
        const status = String((e as unknown as { status?: string }).status ?? "");
        return VISIBLE_STATUSES_FOR_PARTICIPANT.has(status);
      })
      // Teilnehmerkreis-Filter: Admins/Manager etc. sehen immer alles, andere nur ihre Events
      .filter((e) => {
        if (isPrivilegedRole) return true;
        const scope = (e as unknown as { audienceScope?: string }).audienceScope ?? "all";
        if (scope === "all") return true;
        if (scope === "roles") {
          const allowed = (e as unknown as { audienceRoles?: string[] }).audienceRoles ?? [];
          return userRoles.some((r) => allowed.includes(r));
        }
        if (scope === "emails") {
          const allowed = (
            (e as unknown as { audienceEmails?: string[] }).audienceEmails ?? []
          ).map((s) => s.toLowerCase());
          return allowed.includes(userEmail);
        }
        return true;
      });
    return c.json({ events });
  }

  const q = c.req.valid("query");
  const user = getHubUser(c);
  const filter: { status?: (typeof EVENT_STATUSES)[number]; ownerId?: string } = {};
  if (q.status) filter.status = q.status;
  if (q.mine === "true") filter.ownerId = user.id;
  const list = await listEvents(filter, { events });
  return c.json({ events: list });
});

eventRoutes.post(
  "/",
  requireMempRole(...WRITE_ROLES),
  zValidator("json", createEventSchema),
  async (c) => {
    const input = c.req.valid("json");
    const actorId = getHubUser(c).id;
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
  if (!env.DATABASE_URL) {
    const now = new Date();
    const inDays = (d: number) => new Date(now.getTime() + d * 86400000).toISOString();
    const mock: Record<string, ReturnType<typeof JSON.parse>> = {
      "evt-001": {
        id: "evt-001",
        title: "Code & Pizza — Frontend Night",
        description:
          "Lockerer Code-Abend rund um React, Vite und neue UI-Pattern. Kollaboratives Pairing, Demo-Slots, Pizza und Getränke. Ideal zum Netzwerken über Bereiche hinweg.",
        eventType: "team",
        visibility: "internal",
        status: "open",
        startAt: inDays(7),
        endAt: inDays(7),
        location: "Bielefeld HQ",
        capacity: 20,
        ownerId: "550e8400-e29b-41d4-a716-446655440000",
        createdAt: inDays(-14),
        updatedAt: inDays(-1),
      },
      "evt-002": {
        id: "evt-002",
        title: "Sommerfest 2026",
        description:
          "Unser jährliches Betriebsfest mit allen Standorten. BBQ, Live-Musik, Lawn-Games und Familien-Bereich. Anmeldung bis 4 Wochen vorher.",
        eventType: "mindsquare",
        visibility: "internal",
        status: "planned",
        startAt: inDays(45),
        endAt: inDays(45),
        location: "Heidewald",
        capacity: 150,
        ownerId: "550e8400-e29b-41d4-a716-446655440000",
        createdAt: inDays(-30),
        updatedAt: inDays(-3),
      },
      "evt-003": {
        id: "evt-003",
        title: "Q2 Strategie-Tag",
        description:
          "Strategieklausur der Geschäftsführung für die Q2-Planung. OKR-Review, Roadmap-Alignment, Investitionsentscheidungen.",
        eventType: "strategy",
        visibility: "internal",
        status: "running",
        startAt: inDays(-1),
        endAt: inDays(2),
        location: "Online",
        capacity: 30,
        ownerId: "550e8400-e29b-41d4-a716-446655440000",
        createdAt: inDays(-21),
        updatedAt: inDays(-1),
      },
      "evt-004": {
        id: "evt-004",
        title: "Onboarding Welcome Day",
        description:
          "Willkommenstag für neue Kolleg:innen — Rundgang durchs HQ, Tools-Setup, Buddy-Match und gemeinsames Mittagessen.",
        eventType: "office",
        visibility: "internal",
        status: "open",
        startAt: inDays(14),
        endAt: inDays(14),
        location: "Bielefeld HQ",
        capacity: 12,
        ownerId: "550e8400-e29b-41d4-a716-446655440000",
        createdAt: inDays(-10),
        updatedAt: inDays(-1),
      },
      "evt-005": {
        id: "evt-005",
        title: "Padel & Pizza Evening",
        description:
          "Feelgood-Abend: Padel-Plätze für Anfänger und Profis, danach Pizza und kalte Getränke. Schläger werden gestellt.",
        eventType: "feelgood",
        visibility: "internal",
        status: "open",
        startAt: inDays(21),
        endAt: inDays(21),
        location: "Padelhaus Bielefeld",
        capacity: 24,
        ownerId: "550e8400-e29b-41d4-a716-446655440000",
        createdAt: inDays(-7),
        updatedAt: inDays(-1),
      },
      "evt-006": {
        id: "evt-006",
        title: "SAP Bereich All-Hands",
        description:
          "Quartalsupdate des SAP-Bereichs: Roadmap-Highlights, Wins der letzten 90 Tage, Lessons Learned und offene Fragerunde.",
        eventType: "division",
        visibility: "internal",
        status: "planned",
        startAt: inDays(28),
        endAt: inDays(28),
        location: "Online",
        capacity: 80,
        ownerId: "550e8400-e29b-41d4-a716-446655440000",
        createdAt: inDays(-12),
        updatedAt: inDays(-2),
      },
      "evt-007": {
        id: "evt-007",
        title: "Brauerei-Tour Bielefeld",
        description:
          "Local Experience: Geführte Tour durch die Hausbrauerei Joh. Albrecht inkl. Verkostung. Begrenzte Plätze.",
        eventType: "local_experience",
        visibility: "internal",
        status: "draft",
        startAt: inDays(60),
        endAt: inDays(60),
        location: "Brauerei Joh. Albrecht",
        capacity: 18,
        ownerId: "550e8400-e29b-41d4-a716-446655440000",
        createdAt: inDays(-2),
        updatedAt: inDays(-1),
      },
    };
    const event = mock[id];
    if (!event)
      return c.json({ error: { code: "NOT_FOUND", message: "Event nicht gefunden" } }, 404);
    const merged = applyOverride(event);
    if ((merged as { _deleted?: boolean })._deleted) {
      return c.json({ error: { code: "NOT_FOUND", message: "Event nicht gefunden" } }, 404);
    }
    return c.json({ event: merged });
  }
  const event = await getEvent(id, { events });
  return c.json({ event });
});

eventRoutes.patch(
  "/:id",
  requireMempRole(...WRITE_ROLES),
  zValidator("json", updateEventSchema),
  async (c) => {
    const id = c.req.param("id");
    const input = c.req.valid("json");
    const actorId = getHubUser(c).id;

    if (!env.DATABASE_URL) {
      // Dev-Mode: in den Override-Store schreiben
      const current = devEventOverrideStore.get(id) ?? {};
      const next: Record<string, unknown> = { ...current };
      if (input.title !== undefined) next.title = input.title;
      if (input.description !== undefined) next.description = input.description;
      if (input.eventType !== undefined) next.eventType = input.eventType;
      if (input.visibility !== undefined) next.visibility = input.visibility;
      if (input.startAt !== undefined) next.startAt = new Date(input.startAt).toISOString();
      if (input.endAt !== undefined) next.endAt = new Date(input.endAt).toISOString();
      if (input.location !== undefined) next.location = input.location;
      if (input.locationDetails !== undefined) next.locationDetails = input.locationDetails;
      if (input.capacity !== undefined) next.capacity = input.capacity;
      if (input.registrationDeadline !== undefined) {
        next.registrationDeadline = input.registrationDeadline
          ? new Date(input.registrationDeadline).toISOString()
          : null;
      }
      if (input.audienceScope !== undefined) next.audienceScope = input.audienceScope;
      if (input.audienceRoles !== undefined) next.audienceRoles = input.audienceRoles;
      if (input.audienceEmails !== undefined) next.audienceEmails = input.audienceEmails;
      next.updatedAt = new Date().toISOString();
      devEventOverrideStore.set(id, next);

      // Aktuellen Stand zurückgeben — Mock-Basis + Override mergen
      const baseList = buildMockEventList();
      const base = baseList.find((e) => e.id === id);
      if (!base) {
        return c.json({ error: { code: "NOT_FOUND", message: "Event nicht gefunden" } }, 404);
      }
      return c.json({ event: applyOverride(base) });
    }

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

// ICS-Datei für Kalender-Apps (Outlook / Apple Calendar / Google Calendar)
eventRoutes.get("/:id/calendar.ics", async (c) => {
  const id = c.req.param("id");
  let evt: Record<string, unknown> | null = null;

  if (!env.DATABASE_URL) {
    const baseList = buildMockEventList();
    const base = baseList.find((e) => e.id === id);
    if (!base) return c.text("Event nicht gefunden", 404);
    const merged = applyOverride(base) as Record<string, unknown>;
    if ((merged as { _deleted?: boolean })._deleted) {
      return c.text("Event nicht gefunden", 404);
    }
    evt = merged;
  } else {
    const event = await getEvent(id, { events });
    evt = event as unknown as Record<string, unknown>;
  }

  if (!evt) return c.text("Event nicht gefunden", 404);

  const ics = buildIcs({
    id: String(evt.id),
    title: String(evt.title ?? "mEMP Event"),
    description: String(evt.description ?? ""),
    location:
      String(evt.location ?? "") +
      (evt.locationDetails ? `\n\n${String(evt.locationDetails)}` : ""),
    startAt: String(evt.startAt ?? new Date().toISOString()),
    endAt: String(evt.endAt ?? new Date().toISOString()),
  });

  c.header("Content-Type", "text/calendar; charset=utf-8");
  c.header("Content-Disposition", `attachment; filename="memp-${id}.ics"`);
  return c.body(ics);
});

function icsEscape(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function icsDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "00000000T000000Z";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function buildIcs(input: {
  id: string;
  title: string;
  description: string;
  location: string;
  startAt: string;
  endAt: string;
}): string {
  const now = icsDate(new Date().toISOString());
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//mindsquare AG//mEMP//DE",
    "METHOD:PUBLISH",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${input.id}@memp.mindsquare.de`,
    `DTSTAMP:${now}`,
    `DTSTART:${icsDate(input.startAt)}`,
    `DTEND:${icsDate(input.endAt)}`,
    `SUMMARY:${icsEscape(input.title)}`,
    `DESCRIPTION:${icsEscape(input.description)}`,
    `LOCATION:${icsEscape(input.location)}`,
    "STATUS:CONFIRMED",
    "TRANSP:OPAQUE",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

// Event "löschen" — nur Admin. Dev-Mode: in Override-Store als hidden markieren.
eventRoutes.delete("/:id", requireMempRole("admin"), async (c) => {
  const id = c.req.param("id");
  if (!env.DATABASE_URL) {
    const current = devEventOverrideStore.get(id) ?? {};
    devEventOverrideStore.set(id, {
      ...current,
      _deleted: true,
      updatedAt: new Date().toISOString(),
    });
    return c.json({ ok: true });
  }
  return c.json({ error: { code: "NOT_IMPLEMENTED", message: "Delete nur im Dev-Mode" } }, 501);
});

eventRoutes.patch(
  "/:id/status",
  requireMempRole(...WRITE_ROLES),
  zValidator("json", transitionSchema),
  async (c) => {
    const id = c.req.param("id");
    const { status } = c.req.valid("json");
    const actorId = getHubUser(c).id;

    if (!env.DATABASE_URL) {
      // Dev-Mode: Status im Override-Store ablegen
      const current = devEventOverrideStore.get(id) ?? {};
      devEventOverrideStore.set(id, {
        ...current,
        status,
        updatedAt: new Date().toISOString(),
      });
      const baseList = buildMockEventList();
      const base = baseList.find((e) => e.id === id);
      if (!base) {
        return c.json({ error: { code: "NOT_FOUND", message: "Event nicht gefunden" } }, 404);
      }
      return c.json({ event: applyOverride(base) });
    }

    const event = await transitionEventStatus(id, status, actorId, { events, audit });
    return c.json({ event });
  },
);

eventRoutes.get("/:id/my-participation", async (c) => {
  const id = c.req.param("id");
  const actorIdSession = getHubUser(c).id;
  if (!env.DATABASE_URL) {
    const live = devLiveParticipantsStore.get(id) ?? [];
    const found = live.find((p) => p.userId === actorIdSession);
    return c.json({ participation: found ?? null });
  }
  const actorId = actorIdSession;
  const participation = await getOwnParticipation(id, actorId, { events, participations });
  return c.json({ participation });
});

// Notiz zur eigenen Anmeldung bearbeiten
eventRoutes.patch("/:id/my-participation", async (c) => {
  const id = c.req.param("id");
  const actorId = getHubUser(c).id;
  if (env.DATABASE_URL) {
    return c.json({ error: { code: "NOT_IMPLEMENTED", message: "Dev-only" } }, 501);
  }
  let personalNote: string | null = null;
  try {
    const body = (await c.req.json()) as { personalNote?: string | null };
    if (typeof body.personalNote === "string") {
      personalNote = body.personalNote.trim() === "" ? null : body.personalNote.trim();
    } else if (body.personalNote === null) {
      personalNote = null;
    }
  } catch {
    return c.json({ error: { code: "INVALID_BODY", message: "Erwarte JSON" } }, 400);
  }

  const live = devLiveParticipantsStore.get(id) ?? [];
  const idx = live.findIndex((p) => p.userId === actorId);
  if (idx === -1) {
    return c.json(
      { error: { code: "NOT_REGISTERED", message: "Du bist nicht für dieses Event angemeldet." } },
      404,
    );
  }
  const existing = live[idx];
  if (!existing) {
    return c.json(
      { error: { code: "NOT_REGISTERED", message: "Du bist nicht für dieses Event angemeldet." } },
      404,
    );
  }
  const updated = { ...existing, personalNote };
  const nextList = [...live];
  nextList[idx] = updated;
  devLiveParticipantsStore.set(id, nextList);
  return c.json({ participation: updated });
});

eventRoutes.get("/:id/participants", requireMempRole(...WRITE_ROLES), async (c) => {
  const id = c.req.param("id");
  if (!env.DATABASE_URL) {
    const now = new Date();
    const staticParticipants = [
      {
        id: "p-001",
        eventId: id,
        userId: "u-001",
        userDisplayName: "Anna Becker",
        userEmail: "anna.becker@mindsquare.de",
        status: "registered",
        waitlistPosition: null,
        registeredAt: new Date(now.getTime() - 3 * 86400000).toISOString(),
        checkedInAt: null,
        cancelledAt: null,
      },
      {
        id: "p-002",
        eventId: id,
        userId: "u-002",
        userDisplayName: "Tim Hartmann",
        userEmail: "tim.hartmann@mindsquare.de",
        status: "attended",
        waitlistPosition: null,
        registeredAt: new Date(now.getTime() - 5 * 86400000).toISOString(),
        checkedInAt: new Date(now.getTime() - 1 * 3600000).toISOString(),
        cancelledAt: null,
      },
      {
        id: "p-003",
        eventId: id,
        userId: "u-003",
        userDisplayName: "Lara Weber",
        userEmail: "lara.weber@mindsquare.de",
        status: "waitlisted",
        waitlistPosition: 1,
        registeredAt: new Date(now.getTime() - 1 * 86400000).toISOString(),
        checkedInAt: null,
        cancelledAt: null,
      },
    ];
    // Live-Anmeldungen für dieses Event ergänzen
    const live = devLiveParticipantsStore.get(id) ?? [];
    const merged = [...staticParticipants, ...live];
    // Antworten aus devAnswerStore nachladen
    const withAnswers = merged.map((p) => ({
      ...p,
      answers: devAnswerStore.get(p.id) ?? [],
    }));
    return c.json({ participants: withAnswers });
  }
  const list = await listParticipants(id, { events, participations });
  return c.json({ participants: list });
});

eventRoutes.get("/:id/participants.csv", requireMempRole(...WRITE_ROLES), async (c) => {
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

eventRoutes.get("/:id/emergency-list", requireMempRole(...WRITE_ROLES), async (c) => {
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
  const actorId = getHubUser(c).id;
  if (!env.DATABASE_URL) {
    // Anmeldefrist prüfen
    const override = devEventOverrideStore.get(id) ?? {};
    const deadline = (override as { registrationDeadline?: string | null }).registrationDeadline;
    if (deadline) {
      const deadlineMs = new Date(deadline).getTime();
      if (Number.isFinite(deadlineMs) && deadlineMs < Date.now()) {
        return c.json(
          {
            error: {
              code: "REGISTRATION_CLOSED",
              message: "Die Anmeldefrist für dieses Event ist abgelaufen.",
            },
          },
          409,
        );
      }
    }

    // Optional: Antworten + persönliche Notiz lesen
    let answers: { questionId: string; value: boolean | string | string[] | null }[] = [];
    let personalNote: string | null = null;
    try {
      const text = await c.req.text();
      if (text.trim()) {
        const body = JSON.parse(text) as {
          answers?: typeof answers;
          personalNote?: string | null;
        };
        if (Array.isArray(body.answers)) answers = body.answers;
        if (typeof body.personalNote === "string") {
          personalNote = body.personalNote.trim() === "" ? null : body.personalNote.trim();
        }
      }
    } catch {
      // body optional — leerer Body ist OK
    }

    const questions = devFormStore.get(id) ?? [];
    if (questions.length > 0) {
      const validation = validateAnswers(questions, answers);
      if (!validation.ok) {
        return c.json({ error: { code: "INVALID_ANSWERS", message: validation.message } }, 400);
      }
    }

    const participationId = `p-${actorId.slice(0, 8)}`;
    devAnswerStore.set(participationId, answers);

    // Display-Name aus bekannten Dev-Usern auflösen
    const DEV_NAMES: Record<string, { name: string; email: string }> = {
      "550e8400-e29b-41d4-a716-446655440000": {
        name: "Sina (Dev)",
        email: "sina.strathemann@mindsquare.de",
      },
      "550e8400-e29b-41d4-a716-446655440001": {
        name: "Max Mustermann",
        email: "max.mustermann@mindsquare.de",
      },
    };
    const profile = DEV_NAMES[actorId] ?? { name: "Unbekannt", email: "—" };
    const registeredAt = new Date().toISOString();

    // Live-Eintrag in den Participant-Store (Duplikate vermeiden)
    const existing = devLiveParticipantsStore.get(id) ?? [];
    const filtered = existing.filter((p) => p.userId !== actorId);
    filtered.push({
      id: participationId,
      eventId: id,
      userId: actorId,
      userDisplayName: profile.name,
      userEmail: profile.email,
      status: "registered",
      waitlistPosition: null,
      registeredAt,
      checkedInAt: null,
      cancelledAt: null,
      personalNote,
    });
    devLiveParticipantsStore.set(id, filtered);

    return c.json(
      {
        participation: {
          id: participationId,
          eventId: id,
          userId: actorId,
          status: "registered",
          waitlistPosition: null,
          registeredAt,
          checkedInAt: null,
          cancelledAt: null,
        },
        answers,
      },
      201,
    );
  }
  const participation = await registerForEvent({ eventId: id, userId: actorId }, actorId, {
    events,
    participations,
    audit,
  });
  return c.json({ participation }, 201);
});

eventRoutes.post("/:id/withdraw", async (c) => {
  const id = c.req.param("id");
  const actorId = getHubUser(c).id;
  if (!env.DATABASE_URL) {
    const participationId = `p-${actorId.slice(0, 8)}`;
    // Aus Live-Store + Answer-Store entfernen
    const existing = devLiveParticipantsStore.get(id) ?? [];
    devLiveParticipantsStore.set(
      id,
      existing.filter((p) => p.userId !== actorId),
    );
    devAnswerStore.delete(participationId);
    return c.json({
      participation: {
        id: participationId,
        eventId: id,
        userId: actorId,
        status: "cancelled",
        waitlistPosition: null,
        registeredAt: new Date(Date.now() - 86400000).toISOString(),
        checkedInAt: null,
        cancelledAt: new Date().toISOString(),
      },
    });
  }
  const participation = await withdrawFromEvent({ eventId: id, userId: actorId }, actorId, {
    events,
    participations,
    audit,
  });
  return c.json({ participation });
});

eventRoutes.post(
  "/:id/participants/promote-waitlist",
  requireMempRole(...WRITE_ROLES),
  async (c) => {
    const id = c.req.param("id");
    const actorId = getHubUser(c).id;
    const participation = await promoteFromWaitlist(id, actorId, {
      events,
      participations,
      audit,
    });
    return c.json({ participation });
  },
);

eventRoutes.post(
  "/:eventId/participants/:participationId/check-in",
  requireMempRole(...WRITE_ROLES),
  async (c) => {
    const participationId = c.req.param("participationId");
    const actorId = getHubUser(c).id;
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
  requireMempRole(...WRITE_ROLES),
  async (c) => {
    const participationId = c.req.param("participationId");
    const actorId = getHubUser(c).id;
    const participation = await markNoShow(participationId, actorId, {
      events,
      participations,
      audit,
    });
    return c.json({ participation });
  },
);
