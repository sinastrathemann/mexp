import { describe, expect, it } from "vitest";
import { isInactive, orderParticipants, registrationState } from "./registration-state";

const NOW = new Date("2026-11-16T12:00:00.000Z").getTime();

describe("registrationState", () => {
  it("offen ohne Frist und ohne Flag", () => {
    expect(registrationState({ status: "open" }, NOW)).toBe("open");
  });
  it("nicht in Phase offen", () => {
    expect(registrationState({ status: "planned" }, NOW)).toBe("not_open");
  });
  it("manuell geschlossen hat Vorrang vor der Frist", () => {
    expect(
      registrationState(
        { status: "open", registrationClosed: true, registrationDeadline: "2026-11-01T00:00:00Z" },
        NOW,
      ),
    ).toBe("closed_manual");
  });
  it("Frist abgelaufen bzw. noch nicht erreicht", () => {
    expect(
      registrationState({ status: "open", registrationDeadline: "2026-11-15T23:59:00Z" }, NOW),
    ).toBe("closed_deadline");
    expect(
      registrationState({ status: "open", registrationDeadline: "2026-11-17T00:00:00Z" }, NOW),
    ).toBe("open");
  });
});

describe("orderParticipants", () => {
  it("aktive oben in bisheriger Reihenfolge, dann nicht dabei, abgemeldet, nicht erschienen", () => {
    const list = [
      { id: "c", status: "cancelled" as const },
      { id: "r1", status: "registered" as const },
      { id: "d", status: "declined" as const },
      { id: "w", status: "waitlisted" as const },
      { id: "n", status: "no_show" as const },
      { id: "r2", status: "registered" as const },
    ];
    expect(orderParticipants(list).map((p) => p.id)).toEqual(["r1", "w", "r2", "d", "c", "n"]);
  });
  it("isInactive", () => {
    expect(isInactive("declined")).toBe(true);
    expect(isInactive("attended")).toBe(false);
  });
});
