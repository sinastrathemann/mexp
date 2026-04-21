import type { BudgetCategory, BudgetItem } from "@memp/domain";
import { BudgetItemAmountInvalidError, EventNotFoundError } from "@memp/domain";
import { rootLogger } from "@memp/shared";
import type { AuditPort, BudgetPort, EventPort } from "../ports.js";

export interface CreateBudgetItemDeps {
  events: EventPort;
  budgets: BudgetPort;
  audit: AuditPort;
}

export interface CreateBudgetItemInput {
  eventId: string;
  category: BudgetCategory;
  description: string;
  plannedAmountCents: number;
  currency: string;
  taxNote?: string | null;
  notes?: string | null;
}

export async function createBudgetItem(
  input: CreateBudgetItemInput,
  actorId: string,
  deps: CreateBudgetItemDeps,
): Promise<BudgetItem> {
  const log = rootLogger.child({
    module: "create-budget-item",
    eventId: input.eventId,
    actorId,
  });

  if (input.plannedAmountCents < 0) throw new BudgetItemAmountInvalidError();

  const event = await deps.events.findById(input.eventId);
  if (!event) throw new EventNotFoundError(input.eventId);

  const item = await deps.budgets.create({
    eventId: input.eventId,
    category: input.category,
    description: input.description,
    plannedAmountCents: input.plannedAmountCents,
    currency: input.currency,
    taxNote: input.taxNote ?? null,
    notes: input.notes ?? null,
    createdBy: actorId,
  });

  await deps.audit.record({
    entityType: "budget",
    entityId: item.id,
    action: "budget.created",
    actorId,
    after: serialize(item),
    context: { eventId: input.eventId },
  });

  log.info({ budgetItemId: item.id }, "budget item created");
  return item;
}

function serialize(item: BudgetItem): Record<string, unknown> {
  return {
    id: item.id,
    eventId: item.eventId,
    category: item.category,
    description: item.description,
    plannedAmountCents: item.plannedAmountCents,
    currency: item.currency,
    status: item.status,
    taxNote: item.taxNote,
    notes: item.notes,
  };
}
