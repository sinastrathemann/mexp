import type { Participation } from "@memp/domain";
import { EventNotFoundError } from "@memp/domain";
import type { EventPort, ParticipationPort } from "../ports.js";

export interface GetOwnParticipationDeps {
  events: EventPort;
  participations: ParticipationPort;
}

export async function getOwnParticipation(
  eventId: string,
  userId: string,
  deps: GetOwnParticipationDeps,
): Promise<Participation | null> {
  const event = await deps.events.findById(eventId);
  if (!event) throw new EventNotFoundError(eventId);
  return deps.participations.findByEventAndUser(eventId, userId);
}
