import type { Document, DocumentVisibility } from "@mexp/domain";
import { DocumentFileTooLargeError, EventNotFoundError } from "@mexp/domain";
import { rootLogger } from "@mexp/shared";
import type { AuditPort, DocumentPort, EventPort } from "../ports.js";

const MAX_DOCUMENT_BYTES = 50 * 1024 * 1024;

export interface RegisterDocumentDeps {
  events: EventPort;
  documents: DocumentPort;
  audit: AuditPort;
}

export interface RegisterDocumentInput {
  eventId: string;
  name: string;
  mimeType: string;
  fileSize: number;
  storageKey: string;
  visibility: DocumentVisibility;
}

export async function registerDocument(
  input: RegisterDocumentInput,
  actorId: string,
  deps: RegisterDocumentDeps,
): Promise<Document> {
  const log = rootLogger.child({
    module: "register-document",
    eventId: input.eventId,
    actorId,
  });

  const event = await deps.events.findById(input.eventId);
  if (!event) throw new EventNotFoundError(input.eventId);

  if (input.fileSize > MAX_DOCUMENT_BYTES) {
    throw new DocumentFileTooLargeError(input.fileSize, MAX_DOCUMENT_BYTES);
  }

  const doc = await deps.documents.create({
    eventId: input.eventId,
    name: input.name,
    mimeType: input.mimeType,
    fileSize: input.fileSize,
    storageKey: input.storageKey,
    visibility: input.visibility,
    uploadedBy: actorId,
  });

  await deps.audit.record({
    entityType: "document",
    entityId: doc.id,
    action: "document.created",
    actorId,
    after: {
      eventId: doc.eventId,
      name: doc.name,
      mimeType: doc.mimeType,
      fileSize: doc.fileSize,
      visibility: doc.visibility,
    },
    context: { eventId: input.eventId },
  });

  log.info({ documentId: doc.id }, "document registered");
  return doc;
}
