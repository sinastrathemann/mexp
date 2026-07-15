import { randomUUID } from "node:crypto";
import { zValidator } from "@hono/zod-validator";
import { deleteDocument, listDocuments, registerDocument } from "@memp/application";
import { type AuthVariables, requireAuth, requireRole } from "@memp/auth";
import { DOCUMENT_VISIBILITIES } from "@memp/domain";
import { Hono } from "hono";
import { z } from "zod";
import { env, events, audit, documents } from "../deps.js";

const visibilitySchema = z.enum(DOCUMENT_VISIBILITIES);

const createSchema = z.object({
  name: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(200),
  fileSize: z
    .number()
    .int()
    .min(0)
    .max(50 * 1024 * 1024),
  visibility: visibilitySchema.default("event_staff"),
});

const WRITE_ROLES = ["admin", "manager", "event_office", "werkstudent"] as const;
const DELETE_ROLES = ["admin", "manager"] as const;

export const documentRoutes = new Hono<{ Variables: AuthVariables }>();

documentRoutes.use("*", requireAuth());

documentRoutes.get("/events/:eventId/documents", async (c) => {
  const eventId = c.req.param("eventId");
  if (env.NODE_ENV === "development") {
    return c.json({ documents: [] });
  }
  const items = await listDocuments(eventId, { events, documents });
  return c.json({ documents: items });
});

documentRoutes.post(
  "/events/:eventId/documents",
  requireRole(...WRITE_ROLES),
  zValidator("json", createSchema),
  async (c) => {
    const eventId = c.req.param("eventId");
    const input = c.req.valid("json");
    const actorId = c.get("auth").sub;
    const storageKey = `events/${eventId}/${randomUUID()}`;
    const doc = await registerDocument(
      {
        eventId,
        name: input.name,
        mimeType: input.mimeType,
        fileSize: input.fileSize,
        storageKey,
        visibility: input.visibility,
      },
      actorId,
      { events, documents, audit },
    );
    return c.json({ document: doc }, 201);
  },
);

documentRoutes.delete("/documents/:id", requireRole(...DELETE_ROLES), async (c) => {
  const id = c.req.param("id");
  const actorId = c.get("auth").sub;
  await deleteDocument(id, actorId, { documents, audit });
  return c.json({ ok: true });
});
