import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  fmtIsoDate,
  inRange,
  isoWeek,
  mondayOf,
  monthWeeks,
} from "./planning-utils";

describe("planning-utils", () => {
  it("Monatsansicht: Wochen mit Werktagen im Monat", () => {
    // 1.11.2026 ist ein Sonntag → Woche ab 26.10. hat keinen November-Werktag
    expect(monthWeeks("2026-11-17")).toEqual([
      "2026-11-02",
      "2026-11-09",
      "2026-11-16",
      "2026-11-23",
      "2026-11-30",
    ]);
    expect(monthWeeks("2027-02-10")).toEqual([
      "2027-02-01",
      "2027-02-08",
      "2027-02-15",
      "2027-02-22",
    ]);
    expect(addMonths("2026-12-31", 1)).toBe("2027-01-01");
    expect(addMonths("2026-01-31", -1)).toBe("2025-12-01");
  });

  it("mondayOf: Montag der Woche, auch über Monats-/Jahresgrenzen", () => {
    expect(mondayOf("2026-11-16")).toBe("2026-11-16");
    expect(mondayOf("2026-11-22")).toBe("2026-11-16");
    expect(mondayOf("2027-01-01")).toBe("2026-12-28");
  });
  it("addDays", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("isoWeek wie im Contentplan (KW)", () => {
    expect(isoWeek("2026-11-16")).toBe(47);
    expect(isoWeek("2026-01-01")).toBe(1);
    expect(isoWeek("2027-01-01")).toBe(53);
  });
  it("fmtIsoDate + inRange", () => {
    expect(fmtIsoDate("2027-06-19")).toBe("19.06.2027");
    expect(fmtIsoDate("2027-06-19", false)).toBe("19.06.");
    expect(inRange("2027-04-30", "2027-04-29", "2027-05-02")).toBe(true);
    expect(inRange("2027-05-03", "2027-04-29", "2027-05-02")).toBe(false);
    expect(inRange("2027-04-29", "2027-04-29", null)).toBe(true);
  });
});
