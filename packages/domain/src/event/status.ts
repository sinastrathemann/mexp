export const EVENT_STATUSES = [
  "draft",
  "planned",
  "open",
  "running",
  "closed",
  "cancelled",
] as const;

export type EventStatus = (typeof EVENT_STATUSES)[number];

export function isEventStatus(value: unknown): value is EventStatus {
  return typeof value === "string" && (EVENT_STATUSES as readonly string[]).includes(value);
}

const TRANSITIONS: Record<EventStatus, readonly EventStatus[]> = {
  draft: ["planned", "cancelled"],
  planned: ["open", "cancelled"],
  open: ["running", "cancelled"],
  running: ["closed"],
  closed: [],
  cancelled: [],
};

export function canTransition(from: EventStatus, to: EventStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function allowedTransitions(from: EventStatus): readonly EventStatus[] {
  return TRANSITIONS[from];
}
