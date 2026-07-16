import type { EventBlueprint } from "@mexp/domain";
import type { BlueprintPort } from "../ports.js";

export interface ListBlueprintsDeps {
  blueprints: BlueprintPort;
}

export async function listBlueprints(deps: ListBlueprintsDeps): Promise<EventBlueprint[]> {
  return deps.blueprints.list();
}
