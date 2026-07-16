import type { Document } from "@mexp/domain";
import { EventNotFoundError } from "@mexp/domain";
import type { DocumentPort, EventPort } from "../ports.js";

export interface ListDocumentsDeps {
  events: EventPort;
  documents: DocumentPort;
}

export async function listDocuments(eventId: string, deps: ListDocumentsDeps): Promise<Document[]> {
  const event = await deps.events.findById(eventId);
  if (!event) throw new EventNotFoundError(eventId);
  return deps.documents.listForEvent(eventId);
}
