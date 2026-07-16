import { MexpError } from "@mexp/shared";
import type { BudgetItemStatus } from "./budget.js";

export class BudgetItemNotFoundError extends MexpError {
  constructor(id: string) {
    super("BUDGET_ITEM_NOT_FOUND", "Budget-Position nicht gefunden", 404, { id });
  }
}

export class BudgetItemStatusTransitionInvalidError extends MexpError {
  constructor(from: BudgetItemStatus, to: BudgetItemStatus) {
    super(
      "BUDGET_ITEM_STATUS_TRANSITION_INVALID",
      `Budget-Statuswechsel nicht erlaubt: ${from} → ${to}`,
      409,
      { from, to },
    );
  }
}

export class BudgetItemAmountInvalidError extends MexpError {
  constructor() {
    super("BUDGET_ITEM_AMOUNT_INVALID", "Betrag muss ≥ 0 sein", 400);
  }
}
