import { MempError } from "@memp/shared";

export class BlueprintNotFoundError extends MempError {
  constructor(id: string) {
    super("BLUEPRINT_NOT_FOUND", "Blueprint nicht gefunden", 404, { id });
  }
}
