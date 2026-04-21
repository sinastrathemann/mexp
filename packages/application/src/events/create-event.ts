import type { Event, EventCreateInput } from "@memp/domain";
import { InvalidEventDatesError } from "@memp/domain";
import { rootLogger } from "@memp/shared";
import type { AuditPort, EventPort } from "../ports.js";

export interface CreateEventDeps {
  events: EventPort;
  audit: AuditPort;
}

export async function createEvent(
  input: EventCreateInput,
  actorId: string,
  deps: CreateEventDeps,
): Promise<Event> {
  const log = rootLogger.child({ module: "create-event", actorId });

  if (input.endAt <= input.startAt) {
    throw new InvalidEventDatesError();
  }

  const event = await deps.events.create(input);
  await deps.audit.record({
    entityType: "event",
    entityId: event.id,
    action: "event.created",
    actorId,
    after: serializeEvent(event),
  });

  log.info({ eventId: event.id, title: event.title }, "event created");
  return event;
}

function serializeEvent(event: Event): Record<string, unknown> {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    eventType: event.eventType,
    status: event.status,
    visibility: event.visibility,
    startAt: event.startAt.toISOString(),
    endAt: event.endAt.toISOString(),
    location: event.location,
    capacity: event.capacity,
    ownerId: event.ownerId,
  };
}
