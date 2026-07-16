import { MexpError } from "@mexp/shared";

export class BlueprintNotFoundError extends MexpError {
  constructor(id: string) {
    super("BLUEPRINT_NOT_FOUND", "Blueprint nicht gefunden", 404, { id });
  }
}
