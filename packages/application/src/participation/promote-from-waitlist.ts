import type { Participation } from "@memp/domain";
import { EventNotFoundError, NoWaitlistEntryError } from "@memp/domain";
import { rootLogger } from "@memp/shared";
import type { AuditPort, EventPort, ParticipationPort } from "../ports.js";

export interface PromoteFromWaitlistDeps {
  events: EventPort;
  participations: ParticipationPort;
  audit: AuditPort;
}

export async function promoteFromWaitlist(
  eventId: string,
  actorId: string,
  deps: PromoteFromWaitlistDeps,
): Promise<Participation> {
  const log = rootLogger.child({ module: "promote-from-waitlist", eventId, actorId });

  const event = await deps.events.findById(eventId);
  if (!event) throw new EventNotFoundError(eventId);

  const next = await deps.participations.findFirstWaitlisted(eventId);
  if (!next) throw new NoWaitlistEntryError(eventId);

  const before = snapshot(next);
  const previousPosition = next.waitlistPosition;

  const updated = await deps.participations.updateStatus(next.id, "registered", {
    waitlistPosition: null,
  });

  if (previousPosition !== null) {
    await deps.participations.shiftWaitlistPositions(eventId, previousPosition);
  }

  await deps.audit.record({
    entityType: "participation",
    entityId: updated.id,
    action: "participation.promoted_from_waitlist",
    actorId,
    before,
    after: snapshot(updated),
    context: { eventId, userId: updated.userId },
  });

  log.info({ participationId: updated.id, userId: updated.userId }, "promoted from waitlist");
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
