import type { Participation } from "@mexp/domain";
import { EventNotFoundError, ParticipationNotFoundError } from "@mexp/domain";
import { rootLogger } from "@mexp/shared";
import type { AuditPort, EventPort, ParticipationPort } from "../ports.js";

export interface WithdrawFromEventDeps {
  events: EventPort;
  participations: ParticipationPort;
  audit: AuditPort;
}

export interface WithdrawFromEventInput {
  eventId: string;
  userId: string;
}

export async function withdrawFromEvent(
  input: WithdrawFromEventInput,
  actorId: string,
  deps: WithdrawFromEventDeps,
): Promise<Participation> {
  const log = rootLogger.child({
    module: "withdraw-from-event",
    eventId: input.eventId,
    userId: input.userId,
    actorId,
  });

  const event = await deps.events.findById(input.eventId);
  if (!event) throw new EventNotFoundError(input.eventId);

  const existing = await deps.participations.findByEventAndUser(input.eventId, input.userId);
  if (!existing || (existing.status !== "registered" && existing.status !== "waitlisted")) {
    throw new ParticipationNotFoundError(input.eventId, input.userId);
  }

  const before = snapshot(existing);
  const wasWaitlisted = existing.status === "waitlisted";
  const previousPosition = existing.waitlistPosition;

  const updated = await deps.participations.updateStatus(existing.id, "cancelled", {
    waitlistPosition: null,
    cancelledAt: new Date(),
  });

  if (wasWaitlisted && previousPosition !== null) {
    await deps.participations.shiftWaitlistPositions(input.eventId, previousPosition);
  }

  await deps.audit.record({
    entityType: "participation",
    entityId: updated.id,
    action: "participation.cancelled",
    actorId,
    before,
    after: snapshot(updated),
    context: { eventId: input.eventId, userId: input.userId },
  });

  log.info({ participationId: updated.id }, "cancelled");
  return updated;
}

function snapshot(p: Participation): Record<string, unknown> {
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
