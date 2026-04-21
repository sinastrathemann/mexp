import type { Event } from "@memp/domain";
import { EventNotFoundError } from "@memp/domain";
import type { EventPort } from "../ports.js";

export async function getEvent(id: string, deps: { events: EventPort }): Promise<Event> {
  const event = await deps.events.findById(id);
  if (!event) throw new EventNotFoundError(id);
  return event;
}
