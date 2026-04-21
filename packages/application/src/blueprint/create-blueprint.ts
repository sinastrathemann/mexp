import type { EventBlueprint, EventType, EventVisibility } from "@memp/domain";
import { rootLogger } from "@memp/shared";
import type { AuditPort, BlueprintPort } from "../ports.js";

export interface CreateBlueprintDeps {
  blueprints: BlueprintPort;
  audit: AuditPort;
}

export interface CreateBlueprintInput {
  name: string;
  description: string;
  eventType: EventType;
  visibility: EventVisibility;
  defaultDurationMinutes: number;
  defaultCapacity: number | null;
  defaultLocation: string | null;
  defaultDescription: string;
}

export async function createBlueprint(
  input: CreateBlueprintInput,
  actorId: string,
  deps: CreateBlueprintDeps,
): Promise<EventBlueprint> {
  const log = rootLogger.child({ module: "create-blueprint", actorId });

  const blueprint = await deps.blueprints.create({
    name: input.name,
    description: input.description,
    eventType: input.eventType,
    visibility: input.visibility,
    defaultDurationMinutes: input.defaultDurationMinutes,
    defaultCapacity: input.defaultCapacity,
    defaultLocation: input.defaultLocation,
    defaultDescription: input.defaultDescription,
    createdBy: actorId,
  });

  await deps.audit.record({
    entityType: "blueprint",
    entityId: blueprint.id,
    action: "blueprint.created",
    actorId,
    after: {
      name: blueprint.name,
      eventType: blueprint.eventType,
      visibility: blueprint.visibility,
      defaultDurationMinutes: blueprint.defaultDurationMinutes,
    },
  });

  log.info({ blueprintId: blueprint.id }, "blueprint created");
  return blueprint;
}
