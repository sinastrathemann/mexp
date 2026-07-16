import type { Event, EventStatus } from "@mexp/domain";
import type { EventPort } from "../ports.js";

export async function listEvents(
  filter: { status?: EventStatus; ownerId?: string },
  deps: { events: EventPort },
): Promise<Event[]> {
  return deps.events.list(filter);
}
