import { DocumentNotFoundError } from "@mexp/domain";
import { rootLogger } from "@mexp/shared";
import type { AuditPort, DocumentPort } from "../ports.js";

export interface DeleteDocumentDeps {
  documents: DocumentPort;
  audit: AuditPort;
}

export async function deleteDocument(
  id: string,
  actorId: string,
  deps: DeleteDocumentDeps,
): Promise<void> {
  const log = rootLogger.child({ module: "delete-document", documentId: id, actorId });

  const existing = await deps.documents.findById(id);
  if (!existing) throw new DocumentNotFoundError(id);

  await deps.documents.delete(id);

  await deps.audit.record({
    entityType: "document",
    entityId: id,
    action: "document.deleted",
    actorId,
    before: {
      eventId: existing.eventId,
      name: existing.name,
      mimeType: existing.mimeType,
      fileSize: existing.fileSize,
      visibility: existing.visibility,
    },
    context: { eventId: existing.eventId },
  });

  log.info("document deleted");
}
