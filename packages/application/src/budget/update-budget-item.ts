import type { BudgetCategory, BudgetItem } from "@memp/domain";
import {
  BudgetItemAmountInvalidError,
  BudgetItemNotFoundError,
  BudgetItemStatusTransitionInvalidError,
} from "@memp/domain";
import { rootLogger } from "@memp/shared";
import type { AuditPort, BudgetPort } from "../ports.js";

export interface UpdateBudgetItemDeps {
  budgets: BudgetPort;
  audit: AuditPort;
}

export interface UpdateBudgetItemInput {
  category?: BudgetCategory;
  description?: string;
  plannedAmountCents?: number;
  currency?: string;
  taxNote?: string | null;
  notes?: string | null;
}

export async function updateBudgetItem(
  id: string,
  patch: UpdateBudgetItemInput,
  actorId: string,
  deps: UpdateBudgetItemDeps,
): Promise<BudgetItem> {
  const log = rootLogger.child({ module: "update-budget-item", budgetItemId: id, actorId });

  const existing = await deps.budgets.findById(id);
  if (!existing) throw new BudgetItemNotFoundError(id);

  if (existing.status !== "draft" && existing.status !== "rejected") {
    throw new BudgetItemStatusTransitionInvalidError(existing.status, existing.status);
  }

  if (patch.plannedAmountCents !== undefined && patch.plannedAmountCents < 0) {
    throw new BudgetItemAmountInvalidError();
  }

  const updated = await deps.budgets.update(id, patch);

  await deps.audit.record({
    entityType: "budget",
    entityId: id,
    action: "budget.updated",
    actorId,
    before: serialize(existing),
    after: serialize(updated),
    context: { eventId: existing.eventId },
  });

  log.info("budget item updated");
  return updated;
}

function serialize(item: BudgetItem): Record<string, unknown> {
  return {
    category: item.category,
    description: item.description,
    plannedAmountCents: item.plannedAmountCents,
    currency: item.currency,
    taxNote: item.taxNote,
    notes: item.notes,
  };
}
