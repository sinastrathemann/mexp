import type { AuditAction, AuditCreateInput, AuditEntityType, AuditRecord } from "@mexp/domain";
import { desc, eq } from "drizzle-orm";
import type { DbClient } from "../db/client.js";
import type { AuditRow } from "../db/schema/tables.js";
import { auditRecords } from "../db/schema/tables.js";

export class AuditRepository {
  constructor(private readonly db: DbClient) {}

  async record(input: AuditCreateInput): Promise<AuditRecord> {
    const [row] = await this.db
      .insert(auditRecords)
      .values({
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        actorId: input.actorId,
        before: input.before ?? null,
        after: input.after ?? null,
        context: input.context ?? null,
      })
      .returning();
    if (!row) throw new Error("Audit insert returned no row");
    return rowToAudit(row);
  }

  async listForEntity(entityType: AuditEntityType, entityId: string): Promise<AuditRecord[]> {
    const rows = await this.db
      .select()
      .from(auditRecords)
      .where(eq(auditRecords.entityId, entityId))
      .orderBy(desc(auditRecords.createdAt));
    return rows.filter((r) => r.entityType === entityType).map(rowToAudit);
  }
}

function rowToAudit(row: AuditRow): AuditRecord {
  return {
    id: row.id,
    entityType: row.entityType as AuditEntityType,
    entityId: row.entityId,
    action: row.action as AuditAction,
    actorId: row.actorId,
    before: (row.before as Record<string, unknown> | null) ?? null,
    after: (row.after as Record<string, unknown> | null) ?? null,
    context: (row.context as Record<string, unknown> | null) ?? null,
    createdAt: row.createdAt,
  };
}
