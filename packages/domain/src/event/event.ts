import type { EventStatus } from "./status.js";

export const EVENT_VISIBILITIES = ["internal", "public"] as const;
export type EventVisibility = (typeof EVENT_VISIBILITIES)[number];

export const EVENT_TYPES = [
  "mindsquare",
  "office",
  "feelgood",
  "team",
  "strategy",
  "division",
  "local_experience",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export interface Event {
  id: string;
  title: string;
  description: string;
  eventType: EventType;
  status: EventStatus;
  visibility: EventVisibility;
  startAt: Date;
  endAt: Date;
  location: string | null;
  capacity: number | null;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventCreateInput {
  title: string;
  description: string;
  eventType: EventType;
  visibility: EventVisibility;
  startAt: Date;
  endAt: Date;
  location: string | null;
  capacity: number | null;
  ownerId: string;
}

export interface EventUpdateInput {
  title?: string;
  description?: string;
  eventType?: EventType;
  visibility?: EventVisibility;
  startAt?: Date;
  endAt?: Date;
  location?: string | null;
  capacity?: number | null;
}
