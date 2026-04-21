export const DOCUMENT_VISIBILITIES = ["event_staff", "participants", "public"] as const;
export type DocumentVisibility = (typeof DOCUMENT_VISIBILITIES)[number];

export interface Document {
  id: string;
  eventId: string;
  name: string;
  mimeType: string;
  fileSize: number;
  storageKey: string;
  visibility: DocumentVisibility;
  uploadedBy: string;
  uploadedAt: Date;
}

export interface DocumentCreateInput {
  eventId: string;
  name: string;
  mimeType: string;
  fileSize: number;
  storageKey: string;
  visibility: DocumentVisibility;
  uploadedBy: string;
}
