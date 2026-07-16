import type { BudgetItem, BudgetItemStatus } from "@mexp/domain";
import {
  BudgetItemNotFoundError,
  BudgetItemStatusTransitionInvalidError,
  canBudgetTransition,
} from "@mexp/domain";
import { rootLogger } from "@mexp/shared";
import type { AuditPort, BudgetPort } from "../ports.js";

export interface TransitionBudgetItemDeps {
  budgets: BudgetPort;
  audit: AuditPort;
}

type TransitionAction =
  | "budget.submitted"
  | "budget.approved"
  | "budget.rejected"
  | "budget.reopened";

export async function submitBudgetItem(
  id: string,
  actorId: string,
  deps: TransitionBudgetItemDeps,
): Promise<BudgetItem> {
  return transition(id, "submitted", "budget.submitted", actorId, deps, {});
}

export async function approveBudgetItem(
  id: string,
  actorId: string,
  deps: TransitionBudgetItemDeps,
): Promise<BudgetItem> {
  return transition(id, "approved", "budget.approved", actorId, deps, {
    approverId: actorId,
    approvedAt: new Date(),
    rejectedReason: null,
  });
}

export async function rejectBudgetItem(
  id: string,
  reason: string,
  actorId: string,
  deps: TransitionBudgetItemDeps,
): Promise<BudgetItem> {
  return transition(id, "rejected", "budget.rejected", actorId, deps, {
    approverId: actorId,
    approvedAt: null,
    rejectedReason: reason,
  });
}

export async function reopenBudgetItem(
  id: string,
  actorId: string,
  deps: TransitionBudgetItemDeps,
): Promise<BudgetItem> {
  return transition(id, "draft", "budget.reopened", actorId, deps, {
    approverId: null,
    approvedAt: null,
    rejectedReason: null,
  });
}

async function transition(
  id: string,
  next: BudgetItemStatus,
  action: TransitionAction,
  actorId: string,
  deps: TransitionBudgetItemDeps,
  extras: {
    approverId?: string | null;
    approvedAt?: Date | null;
    rejectedReason?: string | null;
  },
): Promise<BudgetItem> {
  const log = rootLogger.child({ module: "transition-budget-item", budgetItemId: id, actorId });

  const existing = await deps.budgets.findById(id);
  if (!existing) throw new BudgetItemNotFoundError(id);

  if (!canBudgetTransition(existing.status, next)) {
    throw new BudgetItemStatusTransitionInvalidError(existing.status, next);
  }

  const updated = await deps.budgets.setStatus(id, next, extras);

  await deps.audit.record({
    entityType: "budget",
    entityId: id,
    action,
    actorId,
    before: { status: existing.status },
    after: {
      status: updated.status,
      approverId: updated.approverId,
      approvedAt: updated.approvedAt ? updated.approvedAt.toISOString() : null,
      rejectedReason: updated.rejectedReason,
    },
    context: { eventId: existing.eventId },
  });

  log.info({ from: existing.status, to: next }, "budget status transitioned");
  return updated;
}
