import type { Event } from "@mexp/domain";
import { EventNotFoundError } from "@mexp/domain";
import type { EventPort } from "../ports.js";

export async function getEvent(id: string, deps: { events: EventPort }): Promise<Event> {
  const event = await deps.events.findById(id);
  if (!event) throw new EventNotFoundError(id);
  return event;
}
