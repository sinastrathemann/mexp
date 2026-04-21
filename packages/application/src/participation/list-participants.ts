import type { ParticipationWithUser } from "@memp/domain";
import { EventNotFoundError } from "@memp/domain";
import type { EventPort, ParticipationPort } from "../ports.js";

export interface ListParticipantsDeps {
  events: EventPort;
  participations: ParticipationPort;
}

export async function listParticipants(
  eventId: string,
  deps: ListParticipantsDeps,
): Promise<ParticipationWithUser[]> {
  const event = await deps.events.findById(eventId);
  if (!event) throw new EventNotFoundError(eventId);
  return deps.participations.listForEvent(eventId);
}
