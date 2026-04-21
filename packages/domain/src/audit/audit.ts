export const AUDIT_ENTITY_TYPES = [
  "event",
  "user",
  "participation",
  "budget",
  "approval",
  "document",
  "blueprint",
  "feedback",
] as const;
export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];

export const AUDIT_ACTIONS = [
  "event.created",
  "event.updated",
  "event.status_changed",
  "user.created",
  "user.role_assigned",
  "user.role_removed",
  "user.active_changed",
  "user.password_reset",
  "participation.registered",
  "participation.waitlisted",
  "participation.cancelled",
  "participation.promoted_from_waitlist",
  "participation.checked_in",
  "participation.marked_no_show",
  "participation.marked_attended_without_checkin",
  "budget.created",
  "budget.updated",
  "budget.submitted",
  "budget.approved",
  "budget.rejected",
  "budget.reopened",
  "document.created",
  "document.deleted",
  "blueprint.created",
  "blueprint.updated",
  "blueprint.deleted",
  "blueprint.applied",
  "feedback.submitted",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface AuditRecord {
  id: string;
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  actorId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  context: Record<string, unknown> | null;
  createdAt: Date;
}

export interface AuditCreateInput {
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  actorId: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  context?: Record<string, unknown> | null;
}
