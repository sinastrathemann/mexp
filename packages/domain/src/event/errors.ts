import { MexpError } from "@mexp/shared";
import type { EventStatus } from "./status.js";

export class EventNotFoundError extends MexpError {
  constructor(id: string) {
    super("EVENT_NOT_FOUND", `Event nicht gefunden: ${id}`, 404, { id });
  }
}

export class InvalidEventStatusTransitionError extends MexpError {
  constructor(from: EventStatus, to: EventStatus) {
    super(
      "EVENT_STATUS_TRANSITION_INVALID",
      `Statuswechsel von '${from}' zu '${to}' ist nicht erlaubt`,
      409,
      { from, to },
    );
  }
}

export class InvalidEventDatesError extends MexpError {
  constructor() {
    super("EVENT_DATES_INVALID", "Das Enddatum muss nach dem Startdatum liegen", 400);
  }
}

export class EventFinalizedError extends MexpError {
  constructor(id: string, status: EventStatus) {
    super(
      "EVENT_FINALIZED",
      `Event '${id}' ist im Status '${status}' und kann nicht mehr bearbeitet werden`,
      409,
      { id, status },
    );
  }
}
