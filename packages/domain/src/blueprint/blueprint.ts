import type { EventType, EventVisibility } from "../event/event.js";

export interface EventBlueprint {
  id: string;
  name: string;
  description: string;
  eventType: EventType;
  visibility: EventVisibility;
  defaultDurationMinutes: number;
  defaultCapacity: number | null;
  defaultLocation: string | null;
  defaultDescription: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventBlueprintCreateInput {
  name: string;
  description: string;
  eventType: EventType;
  visibility: EventVisibility;
  defaultDurationMinutes: number;
  defaultCapacity: number | null;
  defaultLocation: string | null;
  defaultDescription: string;
  createdBy: string;
}

export interface EventBlueprintUpdateInput {
  name?: string;
  description?: string;
  eventType?: EventType;
  visibility?: EventVisibility;
  defaultDurationMinutes?: number;
  defaultCapacity?: number | null;
  defaultLocation?: string | null;
  defaultDescription?: string;
}
