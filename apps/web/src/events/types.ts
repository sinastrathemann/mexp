export const EVENT_STATUSES = [
  "draft",
  "planned",
  "open",
  "running",
  "closed",
  "cancelled",
] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const EVENT_TYPES = ["training", "workshop", "company_event", "other"] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_VISIBILITIES = ["internal", "public"] as const;
export type EventVisibility = (typeof EVENT_VISIBILITIES)[number];

export interface EventDto {
  id: string;
  title: string;
  description: string;
  eventType: EventType;
  status: EventStatus;
  visibility: EventVisibility;
  startAt: string;
  endAt: string;
  location: string | null;
  capacity: number | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

const TRANSITIONS: Record<EventStatus, readonly EventStatus[]> = {
  draft: ["planned", "cancelled"],
  planned: ["open", "cancelled"],
  open: ["running", "cancelled"],
  running: ["closed"],
  closed: [],
  cancelled: [],
};

export function allowedTransitions(status: EventStatus): readonly EventStatus[] {
  return TRANSITIONS[status];
}
