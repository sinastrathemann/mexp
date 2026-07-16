import { randomUUID } from "node:crypto";
import { zValidator } from "@hono/zod-validator";
import { deleteDocument, listDocuments, registerDocument } from "@mexp/application";
import { getHubUser } from "@mexp/auth";
import type { Document } from "@mexp/domain";
import { DOCUMENT_VISIBILITIES } from "@mexp/domain";
import { Hono } from "hono";
import { z } from "zod";
import { events, audit, documents, env } from "../deps.js";
import { persistentMap } from "../dev-persistence.js";
import { requireMexpRole } from "./_user-resolution.js";

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

// Dev-Mode (file-store — Design-Spec §3.4): Store für Dokumenten-Metadaten.
// Persistiert in apps/api/data/documents.json — kein echter Datei-Upload im
// file-store-Modus, nur Metadaten (siehe register-document.ts: `storageKey` bleibt
// ein Platzhalter-Pfad, es wird kein Blob abgelegt).
const documentStore = persistentMap<Document>("documents");

export const documentRoutes = new Hono();

documentRoutes.get("/events/:eventId/documents", async (c) => {
  const eventId = c.req.param("eventId");
  if (!env.DATABASE_URL) {
    const items = Array.from(documentStore.values()).filter((d) => d.eventId === eventId);
    return c.json({ documents: items });
  }
  const items = await listDocuments(eventId, { events, documents });
  return c.json({ documents: items });
});

documentRoutes.post(
  "/events/:eventId/documents",
  requireMexpRole(...WRITE_ROLES),
  zValidator("json", createSchema),
  async (c) => {
    const eventId = c.req.param("eventId");
    const input = c.req.valid("json");
    const actorId = getHubUser(c).id;
    const storageKey = `events/${eventId}/${randomUUID()}`;

    if (!env.DATABASE_URL) {
      const doc: Document = {
        id: randomUUID(),
        eventId,
        name: input.name,
        mimeType: input.mimeType,
        fileSize: input.fileSize,
        storageKey,
        visibility: input.visibility,
        uploadedBy: actorId,
        uploadedAt: new Date(),
      };
      documentStore.set(doc.id, doc);
      return c.json({ document: doc }, 201);
    }

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

documentRoutes.delete("/documents/:id", requireMexpRole(...DELETE_ROLES), async (c) => {
  const id = c.req.param("id");
  const actorId = getHubUser(c).id;
  if (!env.DATABASE_URL) {
    documentStore.delete(id);
    return c.json({ ok: true });
  }
  await deleteDocument(id, actorId, { documents, audit });
  return c.json({ ok: true });
});
