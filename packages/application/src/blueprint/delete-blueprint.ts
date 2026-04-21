import { BlueprintNotFoundError } from "@memp/domain";
import { rootLogger } from "@memp/shared";
import type { AuditPort, BlueprintPort } from "../ports.js";

export interface DeleteBlueprintDeps {
  blueprints: BlueprintPort;
  audit: AuditPort;
}

export async function deleteBlueprint(
  id: string,
  actorId: string,
  deps: DeleteBlueprintDeps,
): Promise<void> {
  const existing = await deps.blueprints.findById(id);
  if (!existing) throw new BlueprintNotFoundError(id);

  await deps.blueprints.delete(id);

  await deps.audit.record({
    entityType: "blueprint",
    entityId: id,
    action: "blueprint.deleted",
    actorId,
    before: { name: existing.name, eventType: existing.eventType },
  });

  rootLogger.child({ module: "delete-blueprint", blueprintId: id }).info("blueprint deleted");
}
