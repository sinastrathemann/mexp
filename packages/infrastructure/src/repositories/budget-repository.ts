import type {
  BudgetCategory,
  BudgetItem,
  BudgetItemCreateInput,
  BudgetItemStatus,
  BudgetItemUpdateInput,
} from "@mexp/domain";
import { desc, eq } from "drizzle-orm";
import type { DbClient } from "../db/client.js";
import type { BudgetItemRow } from "../db/schema/tables.js";
import { budgetItems } from "../db/schema/tables.js";

export class BudgetRepository {
  constructor(private readonly db: DbClient) {}

  async create(input: BudgetItemCreateInput): Promise<BudgetItem> {
    const [row] = await this.db
      .insert(budgetItems)
      .values({
        eventId: input.eventId,
        category: input.category,
        description: input.description,
        plannedAmountCents: input.plannedAmountCents,
        currency: input.currency,
        taxNote: input.taxNote,
        notes: input.notes,
        createdBy: input.createdBy,
      })
      .returning();
    if (!row) throw new Error("BudgetItem insert returned no row");
    return rowToItem(row);
  }

  async findById(id: string): Promise<BudgetItem | null> {
    const rows = await this.db.select().from(budgetItems).where(eq(budgetItems.id, id)).limit(1);
    const row = rows[0];
    return row ? rowToItem(row) : null;
  }

  async listForEvent(eventId: string): Promise<BudgetItem[]> {
    const rows = await this.db
      .select()
      .from(budgetItems)
      .where(eq(budgetItems.eventId, eventId))
      .orderBy(desc(budgetItems.createdAt));
    return rows.map(rowToItem);
  }

  async update(id: string, patch: BudgetItemUpdateInput): Promise<BudgetItem> {
    const values: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.category !== undefined) values["category"] = patch.category;
    if (patch.description !== undefined) values["description"] = patch.description;
    if (patch.plannedAmountCents !== undefined)
      values["plannedAmountCents"] = patch.plannedAmountCents;
    if (patch.currency !== undefined) values["currency"] = patch.currency;
    if (patch.taxNote !== undefined) values["taxNote"] = patch.taxNote;
    if (patch.notes !== undefined) values["notes"] = patch.notes;
    const [row] = await this.db
      .update(budgetItems)
      .set(values)
      .where(eq(budgetItems.id, id))
      .returning();
    if (!row) throw new Error(`BudgetItem ${id} not found during update`);
    return rowToItem(row);
  }

  async setStatus(
    id: string,
    status: BudgetItemStatus,
    extras: {
      approverId?: string | null;
      approvedAt?: Date | null;
      rejectedReason?: string | null;
    } = {},
  ): Promise<BudgetItem> {
    const values: Record<string, unknown> = { status, updatedAt: new Date() };
    if (extras.approverId !== undefined) values["approverId"] = extras.approverId;
    if (extras.approvedAt !== undefined) values["approvedAt"] = extras.approvedAt;
    if (extras.rejectedReason !== undefined) values["rejectedReason"] = extras.rejectedReason;
    const [row] = await this.db
      .update(budgetItems)
      .set(values)
      .where(eq(budgetItems.id, id))
      .returning();
    if (!row) throw new Error(`BudgetItem ${id} not found during status update`);
    return rowToItem(row);
  }
}

function rowToItem(row: BudgetItemRow): BudgetItem {
  return {
    id: row.id,
    eventId: row.eventId,
    category: row.category as BudgetCategory,
    description: row.description,
    plannedAmountCents: row.plannedAmountCents,
    currency: row.currency,
    status: row.status as BudgetItemStatus,
    taxNote: row.taxNote,
    notes: row.notes,
    createdBy: row.createdBy,
    approverId: row.approverId,
    approvedAt: row.approvedAt,
    rejectedReason: row.rejectedReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
