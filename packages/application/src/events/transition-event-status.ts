import type { Event, EventStatus } from "@memp/domain";
import { EventNotFoundError, InvalidEventStatusTransitionError, canTransition } from "@memp/domain";
import { rootLogger } from "@memp/shared";
import type { AuditPort, EventPort } from "../ports.js";

export interface TransitionEventStatusDeps {
  events: EventPort;
  audit: AuditPort;
}

export async function transitionEventStatus(
  id: string,
  nextStatus: EventStatus,
  actorId: string,
  deps: TransitionEventStatusDeps,
): Promise<Event> {
  const log = rootLogger.child({ module: "transition-event-status", actorId, eventId: id });

  const current = await deps.events.findById(id);
  if (!current) throw new EventNotFoundError(id);
  if (!canTransition(current.status, nextStatus)) {
    throw new InvalidEventStatusTransitionError(current.status, nextStatus);
  }

  const updated = await deps.events.setStatus(id, nextStatus);
  await deps.audit.record({
    entityType: "event",
    entityId: id,
    action: "event.status_changed",
    actorId,
    before: { status: current.status },
    after: { status: updated.status },
  });

  log.info({ from: current.status, to: nextStatus }, "event status changed");
  return updated;
}
