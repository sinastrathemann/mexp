import { randomUUID } from "node:crypto";
import { zValidator } from "@hono/zod-validator";
import { getHubUser } from "@mexp/auth";
import { Hono } from "hono";
import { z } from "zod";
import { persistentMap } from "../dev-persistence.js";
import { mexpUserStore, requireMexpRole, resolveMexpRoles } from "./_user-resolution.js";

const eventRequestStatusSchema = z.enum(["submitted", "in_review", "approved", "declined"]);
const isoDateSchema = z.string().datetime({ offset: true });
// Bei der Anfrage nur grob Tag/Abend — die genaue Uhrzeit klärt das Event-Team später.
const timeOfDaySchema = z.enum(["day", "evening"]);

const createRequestSchema = z
  .object({
    category: z.string().trim().min(1).max(100),
    categoryDetails: z.string().max(2000).default(""),
    participantCount: z.number().int().positive().max(500),
    participantList: z.string().max(5000).default(""),
    partnersInvited: z.boolean(),
    dateFixed: z.boolean(),
    fixedDate: isoDateSchema.nullable(),
    timeOfDay: timeOfDaySchema.nullable().default(null),
    hasCalendarBlocker: z.boolean(),
    proposedDates: z.string().max(2000).default(""),
    wholeWeekend: z.boolean(),
    occasion: z.string().trim().min(1).max(2000),
    contactIsRequester: z.boolean(),
    contactName: z.string().max(200).nullable(),
    destination: z.string().max(500).default(""),
    activity: z.string().max(2000).default(""),
    suggestionsWanted: z.boolean(),
    coworking: z.boolean(),
    notes: z.string().max(5000).default(""),
  })
  .superRefine((request, ctx) => {
    if (request.dateFixed && !request.fixedDate) {
      ctx.addIssue({
        code: "custom",
        path: ["fixedDate"],
        message: "Bitte das feste Datum angeben.",
      });
    }
    if (!request.dateFixed && !request.proposedDates.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["proposedDates"],
        message: "Bitte mögliche bzw. abzustimmende Tage angeben.",
      });
    }
    if (!request.contactIsRequester && !request.contactName?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["contactName"],
        message: "Bitte die Ansprechperson angeben.",
      });
    }
  });

const updateRequestSchema = z
  .object({
    status: eventRequestStatusSchema.optional(),
    // null = Zuweisung entfernen
    assignedToId: z.string().min(1).nullable().optional(),
    eventId: z.string().min(1).optional(),
    // Archiv (nur Admin): true = archivieren, false = wiederherstellen
    archived: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Leeres Update." });
const listQuerySchema = z.object({
  view: z.enum(["inbox", "mine", "assigned", "archive"]).optional(),
  mine: z.enum(["true", "false"]).optional(),
  assignee: z.string().min(1).optional(),
});
const REQUEST_MANAGER_ROLES = ["admin", "manager", "event_office", "werkstudent"] as const;
// Nur Admins leiten Anfragen an ein Postfach weiter (Spec 2026-11-10-archiv-design.md §2).
const REQUEST_ASSIGNER_ROLES = ["admin"] as const;

export type EventRequestStatus = z.infer<typeof eventRequestStatusSchema>;

export interface EventRequestRecord {
  id: string;
  requesterId: string;
  requesterName: string | null;
  requesterEmail: string | null;
  category: string;
  categoryDetails: string;
  participantCount: number;
  participantList: string;
  partnersInvited: boolean;
  dateFixed: boolean;
  fixedDate: string | null;
  timeOfDay?: "day" | "evening" | null;
  hasCalendarBlocker: boolean;
  proposedDates: string;
  wholeWeekend: boolean;
  occasion: string;
  contactIsRequester: boolean;
  contactName: string | null;
  destination: string;
  activity: string;
  suggestionsWanted: boolean;
  coworking: boolean;
  notes: string;
  status: EventRequestStatus;
  assignedToId?: string | null;
  assignedToName?: string | null;
  // Event, das aus dieser Anfrage angelegt wurde
  eventId?: string | null;
  // Archiv: fehlt das Feld oder ist es null, ist die Anfrage aktiv (Altbestand bleibt sichtbar)
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export const eventRequestStore = persistentMap<EventRequestRecord>("event-requests");
export const eventRequestRoutes = new Hono();

function hasAnyRole(roles: string[], allowed: readonly string[]): boolean {
  return roles.some((role) => allowed.includes(role));
}
function isArchived(request: EventRequestRecord): boolean {
  return Boolean(request.archivedAt);
}
function isInInbox(request: EventRequestRecord): boolean {
  // Anfragen mit Event sind erledigt — auch Altbestand ohne archivedAt bleibt aus dem Eingang
  return !isArchived(request) && !request.assignedToId && !request.eventId;
}
function isInMailbox(request: EventRequestRecord, userId: string): boolean {
  return !isArchived(request) && request.assignedToId === userId && !request.eventId;
}
function forbidden(message = "Keine Berechtigung.") {
  return { error: { code: "FORBIDDEN", message } };
}

// Zähler für die Seitenleiste ("Ping"). Muss vor "/:id" stehen.
// Neue, noch unbearbeitete Anfragen sieht nur der Admin — so behält er den Überblick
// und entscheidet, wer übernimmt. Alle anderen werden erst gepingt, wenn ihnen eine
// Anfrage zugewiesen wurde (assignedToMe).
eventRequestRoutes.get("/pending-count", requireMexpRole(...REQUEST_MANAGER_ROLES), (c) => {
  const userId = getHubUser(c).id;
  const isAdmin = resolveMexpRoles(c).includes("admin");
  let submitted = 0;
  let assignedToMe = 0;
  for (const request of eventRequestStore.values()) {
    if (isAdmin && isInInbox(request) && request.status === "submitted") submitted++;
    if (
      isInMailbox(request, userId) &&
      (request.status === "submitted" || request.status === "in_review")
    ) {
      assignedToMe++;
    }
  }
  return c.json({ submitted, assignedToMe });
});

// Personen im Team, an die eine Anfrage weitergeleitet werden kann
eventRequestRoutes.get("/assignees", requireMexpRole(...REQUEST_ASSIGNER_ROLES), (c) => {
  const assignees = Array.from(mexpUserStore.values())
    .filter((u) => u.isActive && hasAnyRole(u.roles, REQUEST_MANAGER_ROLES))
    .map((u) => ({ id: u.id, displayName: u.displayName ?? u.email ?? u.id }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "de"));
  return c.json({ assignees });
});

eventRequestRoutes.get("/:id", (c) => {
  const user = getHubUser(c);
  const request = eventRequestStore.get(c.req.param("id"));

  if (!request) {
    return c.json({ error: { code: "NOT_FOUND", message: "Anfrage nicht gefunden." } }, 404);
  }

  const isAdmin = resolveMexpRoles(c).includes("admin");
  if (request.requesterId !== user.id && request.assignedToId !== user.id && !isAdmin) {
    return c.json(forbidden(), 403);
  }

  return c.json({ request });
});

eventRequestRoutes.get("/", zValidator("query", listQuerySchema), (c) => {
  const user = getHubUser(c);
  const roles = resolveMexpRoles(c);
  const canManage = hasAnyRole(roles, REQUEST_MANAGER_ROLES);
  const isAdmin = roles.includes("admin");
  const q = c.req.valid("query");
  const view = q.view ?? (q.mine === "true" || !canManage ? "mine" : undefined);
  const all = Array.from(eventRequestStore.values());

  let requests: EventRequestRecord[];
  if (view === "mine") {
    // Antragstellende sehen ihre Anfragen immer, auch archivierte
    requests = all.filter((r) => r.requesterId === user.id);
  } else if (view === "inbox") {
    if (!isAdmin) return c.json(forbidden(), 403);
    requests = all.filter(isInInbox);
  } else if (view === "archive") {
    if (!isAdmin) return c.json(forbidden(), 403);
    requests = all.filter(isArchived);
  } else if (view === "assigned") {
    const assignee = q.assignee ?? user.id;
    if (assignee !== user.id && !isAdmin) return c.json(forbidden(), 403);
    requests = all.filter((r) => isInMailbox(r, assignee));
  } else {
    // Ohne view: Admin alles, Team-Rollen nur eigene + zugewiesene
    requests = isAdmin
      ? all
      : all.filter((r) => r.requesterId === user.id || r.assignedToId === user.id);
  }
  requests.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return c.json({ requests, canManage });
});

eventRequestRoutes.post("/", zValidator("json", createRequestSchema), (c) => {
  const user = getHubUser(c);
  const input = c.req.valid("json");
  const now = new Date().toISOString();
  const request: EventRequestRecord = {
    id: randomUUID(),
    requesterId: user.id,
    requesterName: user.name,
    requesterEmail: user.email,
    ...input,
    status: "submitted",
    assignedToId: null,
    assignedToName: null,
    eventId: null,
    createdAt: now,
    updatedAt: now,
  };
  eventRequestStore.set(request.id, request);
  return c.json({ request }, 201);
});

eventRequestRoutes.patch(
  "/:id",
  requireMexpRole(...REQUEST_MANAGER_ROLES),
  zValidator("json", updateRequestSchema),
  (c) => {
    const request = eventRequestStore.get(c.req.param("id"));
    if (!request) {
      return c.json({ error: { code: "NOT_FOUND", message: "Anfrage nicht gefunden." } }, 404);
    }
    const input = c.req.valid("json");
    const user = getHubUser(c);
    const isAdmin = resolveMexpRoles(c).includes("admin");
    // Nicht-Admins bearbeiten nur Anfragen in ihrem Postfach
    if (!isAdmin && request.assignedToId !== user.id) {
      return c.json(forbidden(), 403);
    }
    if (input.archived !== undefined && !isAdmin) {
      return c.json(forbidden("Nur Admins dürfen Anfragen archivieren."), 403);
    }
    const now = new Date().toISOString();
    const updated: EventRequestRecord = { ...request, updatedAt: now };
    if (input.status) updated.status = input.status;
    if (input.eventId) {
      updated.eventId = input.eventId;
      // Event angelegt → Anfrage verlässt das Postfach und liegt im Archiv
      updated.archivedAt = updated.archivedAt ?? now;
    }
    if (input.archived === true) updated.archivedAt = updated.archivedAt ?? now;
    if (input.archived === false) updated.archivedAt = null;
    if (input.assignedToId !== undefined) {
      if (!hasAnyRole(resolveMexpRoles(c), REQUEST_ASSIGNER_ROLES)) {
        return c.json(forbidden("Nur Admins dürfen Anfragen weiterleiten."), 403);
      }
      if (input.assignedToId === null) {
        updated.assignedToId = null;
        updated.assignedToName = null;
      } else {
        const assignee = mexpUserStore.get(input.assignedToId);
        if (!assignee || !hasAnyRole(assignee.roles, REQUEST_MANAGER_ROLES)) {
          return c.json(
            {
              error: {
                code: "INVALID_ASSIGNEE",
                message: "Diese Person kann keine Eventanfragen bearbeiten.",
              },
            },
            400,
          );
        }
        updated.assignedToId = assignee.id;
        updated.assignedToName = assignee.displayName ?? assignee.email ?? assignee.id;
        if (updated.status === "submitted") updated.status = "in_review";
      }
    }
    eventRequestStore.set(updated.id, updated);
    return c.json({ request: updated });
  },
);
