import type { Event, EventUpdateInput } from "@mexp/domain";
import { EventFinalizedError, EventNotFoundError, InvalidEventDatesError } from "@mexp/domain";
import { rootLogger } from "@mexp/shared";
import type { AuditPort, EventPort } from "../ports.js";

export interface UpdateEventDeps {
  events: EventPort;
  audit: AuditPort;
}

export async function updateEvent(
  id: string,
  patch: EventUpdateInput,
  actorId: string,
  deps: UpdateEventDeps,
): Promise<Event> {
  const log = rootLogger.child({ module: "update-event", actorId, eventId: id });

  const current = await deps.events.findById(id);
  if (!current) throw new EventNotFoundError(id);
  if (current.status === "closed" || current.status === "cancelled") {
    throw new EventFinalizedError(id, current.status);
  }

  const nextStart = patch.startAt ?? current.startAt;
  const nextEnd = patch.endAt ?? current.endAt;
  if (nextEnd <= nextStart) {
    throw new InvalidEventDatesError();
  }

  const updated = await deps.events.update(id, patch);
  await deps.audit.record({
    entityType: "event",
    entityId: id,
    action: "event.updated",
    actorId,
    before: diffBase(current, patch),
    after: diffAfter(updated, patch),
  });

  log.info("event updated");
  return updated;
}

function diffBase(event: Event, patch: EventUpdateInput): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(patch) as (keyof EventUpdateInput)[]) {
    result[key] = event[key] instanceof Date ? (event[key] as Date).toISOString() : event[key];
  }
  return result;
}

function diffAfter(event: Event, patch: EventUpdateInput): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(patch) as (keyof EventUpdateInput)[]) {
    result[key] = event[key] instanceof Date ? (event[key] as Date).toISOString() : event[key];
  }
  return result;
}
