import type { Document, DocumentCreateInput, DocumentVisibility } from "@memp/domain";
import { desc, eq } from "drizzle-orm";
import type { DbClient } from "../db/client.js";
import type { DocumentRow } from "../db/schema/tables.js";
import { documents } from "../db/schema/tables.js";

export class DocumentRepository {
  constructor(private readonly db: DbClient) {}

  async create(input: DocumentCreateInput): Promise<Document> {
    const [row] = await this.db
      .insert(documents)
      .values({
        eventId: input.eventId,
        name: input.name,
        mimeType: input.mimeType,
        fileSize: input.fileSize,
        storageKey: input.storageKey,
        visibility: input.visibility,
        uploadedBy: input.uploadedBy,
      })
      .returning();
    if (!row) throw new Error("Document insert returned no row");
    return rowToDoc(row);
  }

  async findById(id: string): Promise<Document | null> {
    const rows = await this.db.select().from(documents).where(eq(documents.id, id)).limit(1);
    const row = rows[0];
    return row ? rowToDoc(row) : null;
  }

  async listForEvent(eventId: string): Promise<Document[]> {
    const rows = await this.db
      .select()
      .from(documents)
      .where(eq(documents.eventId, eventId))
      .orderBy(desc(documents.uploadedAt));
    return rows.map(rowToDoc);
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(documents).where(eq(documents.id, id));
  }
}

function rowToDoc(row: DocumentRow): Document {
  return {
    id: row.id,
    eventId: row.eventId,
    name: row.name,
    mimeType: row.mimeType,
    fileSize: row.fileSize,
    storageKey: row.storageKey,
    visibility: row.visibility as DocumentVisibility,
    uploadedBy: row.uploadedBy,
    uploadedAt: row.uploadedAt,
  };
}
