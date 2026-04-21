import type { EventBlueprint, EventBlueprintUpdateInput } from "@memp/domain";
import { BlueprintNotFoundError } from "@memp/domain";
import { rootLogger } from "@memp/shared";
import type { AuditPort, BlueprintPort } from "../ports.js";

export interface UpdateBlueprintDeps {
  blueprints: BlueprintPort;
  audit: AuditPort;
}

export async function updateBlueprint(
  id: string,
  patch: EventBlueprintUpdateInput,
  actorId: string,
  deps: UpdateBlueprintDeps,
): Promise<EventBlueprint> {
  const log = rootLogger.child({ module: "update-blueprint", blueprintId: id, actorId });

  const existing = await deps.blueprints.findById(id);
  if (!existing) throw new BlueprintNotFoundError(id);

  const updated = await deps.blueprints.update(id, patch);

  await deps.audit.record({
    entityType: "blueprint",
    entityId: id,
    action: "blueprint.updated",
    actorId,
    before: { name: existing.name, eventType: existing.eventType },
    after: { name: updated.name, eventType: updated.eventType },
  });

  log.info("blueprint updated");
  return updated;
}
