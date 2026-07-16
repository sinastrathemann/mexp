import type { Event } from "@mexp/domain";
import { BlueprintNotFoundError } from "@mexp/domain";
import { rootLogger } from "@mexp/shared";
import type { AuditPort, BlueprintPort, EventPort } from "../ports.js";

export interface ApplyBlueprintDeps {
  blueprints: BlueprintPort;
  events: EventPort;
  audit: AuditPort;
}

export interface ApplyBlueprintInput {
  blueprintId: string;
  title: string;
  startAt: Date;
}

export async function applyBlueprint(
  input: ApplyBlueprintInput,
  actorId: string,
  deps: ApplyBlueprintDeps,
): Promise<Event> {
  const log = rootLogger.child({
    module: "apply-blueprint",
    blueprintId: input.blueprintId,
    actorId,
  });

  const blueprint = await deps.blueprints.findById(input.blueprintId);
  if (!blueprint) throw new BlueprintNotFoundError(input.blueprintId);

  const endAt = new Date(input.startAt.getTime() + blueprint.defaultDurationMinutes * 60_000);

  const event = await deps.events.create({
    title: input.title,
    description: blueprint.defaultDescription,
    eventType: blueprint.eventType,
    visibility: blueprint.visibility,
    startAt: input.startAt,
    endAt,
    location: blueprint.defaultLocation,
    // Blueprints kennen (noch) keine locationDetails — Event startet ohne, kann danach ergänzt werden.
    locationDetails: null,
    capacity: blueprint.defaultCapacity,
    ownerId: actorId,
  });

  await deps.audit.record({
    entityType: "event",
    entityId: event.id,
    action: "event.created",
    actorId,
    after: {
      title: event.title,
      eventType: event.eventType,
      visibility: event.visibility,
      startAt: event.startAt.toISOString(),
      endAt: event.endAt.toISOString(),
      fromBlueprintId: blueprint.id,
    },
  });

  await deps.audit.record({
    entityType: "blueprint",
    entityId: blueprint.id,
    action: "blueprint.applied",
    actorId,
    context: { eventId: event.id, blueprintName: blueprint.name },
  });

  log.info({ eventId: event.id }, "blueprint applied to new event");
  return event;
}
