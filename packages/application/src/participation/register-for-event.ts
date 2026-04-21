import type { Participation } from "@memp/domain";
import { AlreadyRegisteredError, EventNotFoundError, RegistrationNotOpenError } from "@memp/domain";
import { rootLogger } from "@memp/shared";
import type { AuditPort, EventPort, ParticipationPort } from "../ports.js";

export interface RegisterForEventDeps {
  events: EventPort;
  participations: ParticipationPort;
  audit: AuditPort;
}

export interface RegisterForEventInput {
  eventId: string;
  userId: string;
}

export async function registerForEvent(
  input: RegisterForEventInput,
  actorId: string,
  deps: RegisterForEventDeps,
): Promise<Participation> {
  const log = rootLogger.child({
    module: "register-for-event",
    eventId: input.eventId,
    userId: input.userId,
    actorId,
  });

  const event = await deps.events.findById(input.eventId);
  if (!event) throw new EventNotFoundError(input.eventId);

  if (event.status !== "open") {
    throw new RegistrationNotOpenError(event.status);
  }

  const existing = await deps.participations.findByEventAndUser(input.eventId, input.userId);
  if (existing && (existing.status === "registered" || existing.status === "waitlisted")) {
    throw new AlreadyRegisteredError(input.eventId, input.userId);
  }

  const activeCount = await deps.participations.countActiveForEvent(input.eventId);
  const capacityReached = event.capacity !== null && activeCount >= event.capacity;

  if (capacityReached) {
    const waitlistCount = await deps.participations.countWaitlistForEvent(input.eventId);
    const nextPosition = waitlistCount + 1;
    const participation = await deps.participations.create({
      eventId: input.eventId,
      userId: input.userId,
      status: "waitlisted",
      waitlistPosition: nextPosition,
    });
    await deps.audit.record({
      entityType: "participation",
      entityId: participation.id,
      action: "participation.waitlisted",
      actorId,
      after: serialize(participation),
      context: { eventId: input.eventId, userId: input.userId },
    });
    log.info({ participationId: participation.id, position: nextPosition }, "waitlisted");
    return participation;
  }

  const participation = await deps.participations.create({
    eventId: input.eventId,
    userId: input.userId,
    status: "registered",
    waitlistPosition: null,
  });
  await deps.audit.record({
    entityType: "participation",
    entityId: participation.id,
    action: "participation.registered",
    actorId,
    after: serialize(participation),
    context: { eventId: input.eventId, userId: input.userId },
  });
  log.info({ participationId: participation.id }, "registered");
  return participation;
}

function serialize(p: Participation): Record<string, unknown> {
  return {
    id: p.id,
    eventId: p.eventId,
    userId: p.userId,
    status: p.status,
    waitlistPosition: p.waitlistPosition,
    registeredAt: p.registeredAt.toISOString(),
    cancelledAt: p.cancelledAt ? p.cancelledAt.toISOString() : null,
    checkedInAt: p.checkedInAt ? p.checkedInAt.toISOString() : null,
  };
}
