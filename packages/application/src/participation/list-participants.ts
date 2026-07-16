import type { ParticipationWithUser } from "@mexp/domain";
import { EventNotFoundError } from "@mexp/domain";
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
