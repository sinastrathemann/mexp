import type { Participation } from "@mexp/domain";
import {
  CheckInNotAllowedError,
  EventNotFoundError,
  ParticipationNotFoundError,
  ParticipationStatusInvalidError,
} from "@mexp/domain";
import { rootLogger } from "@mexp/shared";
import type { AuditPort, EventPort, ParticipationPort } from "../ports.js";

export interface CheckInParticipantDeps {
  events: EventPort;
  participations: ParticipationPort;
  audit: AuditPort;
}

export async function checkInParticipant(
  participationId: string,
  actorId: string,
  deps: CheckInParticipantDeps,
): Promise<Participation> {
  const log = rootLogger.child({ module: "check-in-participant", participationId, actorId });

  const participation = await deps.participations.findById(participationId);
  if (!participation) {
    throw new ParticipationNotFoundError("", participationId);
  }

  const event = await deps.events.findById(participation.eventId);
  if (!event) throw new EventNotFoundError(participation.eventId);

  if (event.status !== "open" && event.status !== "running") {
    throw new CheckInNotAllowedError(event.status);
  }

  if (participation.status !== "registered") {
    throw new ParticipationStatusInvalidError(participation.status, "registered");
  }

  const before = serialize(participation);
  const updated = await deps.participations.updateStatus(participationId, "attended", {
    checkedInAt: new Date(),
  });

  await deps.audit.record({
    entityType: "participation",
    entityId: updated.id,
    action: "participation.checked_in",
    actorId,
    before,
    after: serialize(updated),
    context: { eventId: event.id, userId: updated.userId },
  });

  log.info({ eventId: event.id, userId: updated.userId }, "checked in");
  return updated;
}

export async function markNoShow(
  participationId: string,
  actorId: string,
  deps: CheckInParticipantDeps,
): Promise<Participation> {
  const log = rootLogger.child({ module: "mark-no-show", participationId, actorId });

  const participation = await deps.participations.findById(participationId);
  if (!participation) throw new ParticipationNotFoundError("", participationId);

  const event = await deps.events.findById(participation.eventId);
  if (!event) throw new EventNotFoundError(participation.eventId);

  if (event.status !== "running" && event.status !== "closed") {
    throw new CheckInNotAllowedError(event.status);
  }

  if (participation.status !== "registered") {
    throw new ParticipationStatusInvalidError(participation.status, "registered");
  }

  const before = serialize(participation);
  const updated = await deps.participations.updateStatus(participationId, "no_show");

  await deps.audit.record({
    entityType: "participation",
    entityId: updated.id,
    action: "participation.marked_no_show",
    actorId,
    before,
    after: serialize(updated),
    context: { eventId: event.id, userId: updated.userId },
  });

  log.info({ eventId: event.id, userId: updated.userId }, "marked as no-show");
  return updated;
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
