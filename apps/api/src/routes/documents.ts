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
import { volumeDocumentFileStore } from "../document-files.js";
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
// Löschen nur Admin (Sina's Regel: Anlegen/Bearbeiten dürfen mehr Rollen, Löschen nicht).
const DELETE_ROLES = ["admin"] as const;

// Dev-Mode (file-store — Design-Spec §3.4): Store für Dokumenten-Metadaten.
// Persistiert in apps/api/data/documents.json. Seit Runde 6 mit echter Datei
// (hasFile + fileId, Ablage über DocumentFileStore). Ältere Einträge haben nur
// Metadaten — sie bleiben unverändert und haben keine Datei.
type StoredDocument = Document & { hasFile?: boolean; fileId?: string };
export const documentStore = persistentMap<StoredDocument>("documents");

/** Max. Dateigröße pro Upload (Spec Runde 6). */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

// Nur diese Typen öffnen sich im Browser; alles andere (v. a. HTML/SVG) als Download
const INLINE_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

function contentDisposition(kind: "inline" | "attachment", name: string): string {
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

const withFileFlag = (d: StoredDocument) => ({ ...d, hasFile: d.hasFile === true });

export const documentRoutes = new Hono();

documentRoutes.get("/events/:eventId/documents", async (c) => {
  const eventId = c.req.param("eventId");
  if (!env.DATABASE_URL) {
    const items = Array.from(documentStore.values())
      .filter((d) => d.eventId === eventId)
      .map(withFileFlag);
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

// Runde 6: echte Datei hochladen (multipart: file + visibility)
documentRoutes.post(
  "/events/:eventId/documents/upload",
  requireMexpRole(...WRITE_ROLES),
  async (c) => {
    const eventId = c.req.param("eventId");
    if (env.DATABASE_URL) {
      return c.json(
        { error: { code: "NOT_IMPLEMENTED", message: "Upload nur im file-store" } },
        501,
      );
    }
    const form = await c.req.parseBody();
    const file = form["file"];
    if (!(file instanceof File) || file.name.trim() === "") {
      return c.json({ error: { code: "NO_FILE", message: "Bitte eine Datei auswählen." } }, 400);
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return c.json(
        { error: { code: "FILE_TOO_LARGE", message: "Die Datei ist größer als 25 MB." } },
        413,
      );
    }
    const visibility = visibilitySchema.safeParse(form["visibility"] ?? "event_staff");
    if (!visibility.success) {
      return c.json(
        { error: { code: "INVALID_VISIBILITY", message: "Ungültige Sichtbarkeit." } },
        400,
      );
    }
    const id = randomUUID();
    const fileId = randomUUID();
    volumeDocumentFileStore.save(fileId, new Uint8Array(await file.arrayBuffer()));
    const doc: StoredDocument = {
      id,
      eventId,
      name: file.name.trim().slice(0, 255),
      mimeType: (file.type || "application/octet-stream").slice(0, 200),
      fileSize: file.size,
      storageKey: `files/${fileId}`,
      visibility: visibility.data,
      uploadedBy: getHubUser(c).id,
      uploadedAt: new Date(),
      hasFile: true,
      fileId,
    };
    documentStore.set(id, doc);
    return c.json({ document: withFileFlag(doc) }, 201);
  },
);

// Runde 6: Datei öffnen/herunterladen — nur Team (Dokumente-Bereich ist Team-only)
documentRoutes.get("/documents/:id/file", requireMexpRole(...WRITE_ROLES), (c) => {
  const doc = documentStore.get(c.req.param("id"));
  const data = doc?.hasFile && doc.fileId ? volumeDocumentFileStore.read(doc.fileId) : null;
  if (!doc || !data) {
    return c.json({ error: { code: "NOT_FOUND", message: "Keine Datei vorhanden." } }, 404);
  }
  const inline = INLINE_TYPES.has(doc.mimeType);
  c.header("Content-Type", inline ? doc.mimeType : "application/octet-stream");
  c.header("Content-Disposition", contentDisposition(inline ? "inline" : "attachment", doc.name));
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Cache-Control", "private, no-store");
  return c.body(new Uint8Array(data));
});

documentRoutes.delete("/documents/:id", requireMexpRole(...DELETE_ROLES), async (c) => {
  const id = c.req.param("id");
  const actorId = getHubUser(c).id;
  if (!env.DATABASE_URL) {
    const doc = documentStore.get(id);
    if (doc?.fileId) volumeDocumentFileStore.remove(doc.fileId);
    documentStore.delete(id);
    return c.json({ ok: true });
  }
  await deleteDocument(id, actorId, { documents, audit });
  return c.json({ ok: true });
});
