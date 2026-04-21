export const BUDGET_CATEGORIES = [
  "venue",
  "catering",
  "material",
  "travel",
  "speaker_fee",
  "other",
] as const;
export type BudgetCategory = (typeof BUDGET_CATEGORIES)[number];

export const BUDGET_ITEM_STATUSES = ["draft", "submitted", "approved", "rejected"] as const;
export type BudgetItemStatus = (typeof BUDGET_ITEM_STATUSES)[number];

const BUDGET_TRANSITIONS: Record<BudgetItemStatus, readonly BudgetItemStatus[]> = {
  draft: ["submitted"],
  submitted: ["approved", "rejected", "draft"],
  approved: [],
  rejected: ["draft"],
};

export function canBudgetTransition(from: BudgetItemStatus, to: BudgetItemStatus): boolean {
  return BUDGET_TRANSITIONS[from].includes(to);
}

export function allowedBudgetTransitions(from: BudgetItemStatus): readonly BudgetItemStatus[] {
  return BUDGET_TRANSITIONS[from];
}

export interface BudgetItem {
  id: string;
  eventId: string;
  category: BudgetCategory;
  description: string;
  plannedAmountCents: number;
  currency: string;
  status: BudgetItemStatus;
  taxNote: string | null;
  notes: string | null;
  createdBy: string;
  approverId: string | null;
  approvedAt: Date | null;
  rejectedReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BudgetItemCreateInput {
  eventId: string;
  category: BudgetCategory;
  description: string;
  plannedAmountCents: number;
  currency: string;
  taxNote: string | null;
  notes: string | null;
  createdBy: string;
}

export interface BudgetItemUpdateInput {
  category?: BudgetCategory;
  description?: string;
  plannedAmountCents?: number;
  currency?: string;
  taxNote?: string | null;
  notes?: string | null;
}
