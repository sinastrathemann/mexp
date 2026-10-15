import { randomUUID } from "node:crypto";
import { zValidator } from "@hono/zod-validator";
import { getHubUser } from "@mexp/auth";
import { Hono } from "hono";
import { z } from "zod";
import { persistentMap } from "../dev-persistence.js";
import { requireMexpRole, resolveMexpRoles } from "./_user-resolution.js";

const eventRequestStatusSchema = z.enum(["submitted", "in_review", "approved", "declined"]);
const isoDateSchema = z.string().datetime({ offset: true });

const createRequestSchema = z
  .object({
    category: z.string().trim().min(1).max(100),
    categoryDetails: z.string().max(2000).default(""),
    participantCount: z.number().int().positive().max(500),
    participantList: z.string().max(5000).default(""),
    partnersInvited: z.boolean(),
    dateFixed: z.boolean(),
    fixedDate: isoDateSchema.nullable(),
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

const updateRequestSchema = z.object({ status: eventRequestStatusSchema });
const REQUEST_MANAGER_ROLES = ["admin", "manager", "event_office", "werkstudent"] as const;

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
  createdAt: string;
  updatedAt: string;
}

export const eventRequestStore = persistentMap<EventRequestRecord>("event-requests");
export const eventRequestRoutes = new Hono();

eventRequestRoutes.get("/:id", (c) => {
  const user = getHubUser(c);
  const request = eventRequestStore.get(c.req.param("id"));

  if (!request) {
    return c.json({ error: { code: "NOT_FOUND", message: "Anfrage nicht gefunden." } }, 404);
  }

  const roles = resolveMexpRoles(c);
  const canManage = roles.some((role) => REQUEST_MANAGER_ROLES.includes(role as never));
  if (request.requesterId !== user.id && !canManage) {
    return c.json({ error: { code: "FORBIDDEN", message: "Keine Berechtigung." } }, 403);
  }

  return c.json({ request });
});

eventRequestRoutes.get("/", (c) => {
  const user = getHubUser(c);
  const canManage = resolveMexpRoles(c).some((role) =>
    REQUEST_MANAGER_ROLES.includes(role as never),
  );
  const mineOnly = !canManage || c.req.query("mine") === "true";
  const requests = Array.from(eventRequestStore.values())
    .filter((request) => !mineOnly || request.requesterId === user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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
    const updated: EventRequestRecord = {
      ...request,
      status: c.req.valid("json").status,
      updatedAt: new Date().toISOString(),
    };
    eventRequestStore.set(updated.id, updated);
    return c.json({ request: updated });
  },
);
