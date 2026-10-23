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

// Admins können flexibel zwischen Status wechseln (Anmeldung öffnen, wieder schließen, Event
// starten/zurückziehen). Auch aus closed/cancelled ist der Rückgang in einen Vorzustand erlaubt.
// Diese Tabelle muss mit apps/web/src/events/types.ts übereinstimmen (tests/unit/event-status-transitions.test.ts).
const TRANSITIONS: Record<EventStatus, readonly EventStatus[]> = {
  draft: ["planned", "open", "cancelled"],
  planned: ["draft", "open", "running", "cancelled"],
  open: ["draft", "planned", "running", "cancelled"],
  running: ["open", "closed", "cancelled"],
  closed: ["running"],
  cancelled: ["draft", "planned"],
};

export function canTransition(from: EventStatus, to: EventStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function allowedTransitions(from: EventStatus): readonly EventStatus[] {
  return TRANSITIONS[from];
}
