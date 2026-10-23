import { describe, expect, it } from "vitest";
import { allowedTransitions as webAllowedTransitions } from "../../apps/web/src/events/types";
import {
  EVENT_STATUSES,
  allowedTransitions,
  canTransition,
} from "../../packages/domain/src/event/status";

describe("Event-Statuswechsel: Domain und Oberfläche stimmen überein", () => {
  for (const status of EVENT_STATUSES) {
    it(`gleiche Übergänge ab '${status}'`, () => {
      expect([...allowedTransitions(status)].sort()).toEqual(
        [...webAllowedTransitions(status)].sort(),
      );
    });
  }

  it("abgesagte Events dürfen reaktiviert werden", () => {
    expect(canTransition("cancelled", "draft")).toBe(true);
  });

  it("geschlossene Events gehen nicht zurück auf Entwurf", () => {
    expect(canTransition("closed", "draft")).toBe(false);
  });
});
