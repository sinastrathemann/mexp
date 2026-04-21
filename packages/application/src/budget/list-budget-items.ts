import type { BudgetItem } from "@memp/domain";
import { EventNotFoundError } from "@memp/domain";
import type { BudgetPort, EventPort } from "../ports.js";

export interface ListBudgetItemsDeps {
  events: EventPort;
  budgets: BudgetPort;
}

export async function listBudgetItems(
  eventId: string,
  deps: ListBudgetItemsDeps,
): Promise<BudgetItem[]> {
  const event = await deps.events.findById(eventId);
  if (!event) throw new EventNotFoundError(eventId);
  return deps.budgets.listForEvent(eventId);
}
