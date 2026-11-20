import { describe, expect, it } from "vitest";
import { localDay, shiftEventDates } from "./duplicate-dates";

describe("shiftEventDates", () => {
  const startAt = "2027-03-10T09:00:00.000Z";
  const endAt = "2027-03-11T17:00:00.000Z";

  it("setzt den neuen Starttag", () => {
    expect(localDay(shiftEventDates(startAt, endAt, "2027-09-15").startAt)).toBe("2027-09-15");
  });

  it("behält die lokale Uhrzeit", () => {
    const moved = new Date(shiftEventDates(startAt, endAt, "2027-03-24").startAt);
    const orig = new Date(startAt);
    expect([moved.getHours(), moved.getMinutes()]).toEqual([orig.getHours(), orig.getMinutes()]);
  });

  it("behält die Dauer", () => {
    const r = shiftEventDates(startAt, endAt, "2027-03-24");
    expect(new Date(r.endAt).getTime() - new Date(r.startAt).getTime()).toBe(
      new Date(endAt).getTime() - new Date(startAt).getTime(),
    );
  });
});
