import { describe, expect, it } from "vitest";
import { formatEventDate, tbdDateInput, tbdIso } from "./event-date";

describe("formatEventDate", () => {
  it("zeigt bei offener Uhrzeit nur das Datum plus Hinweis", () => {
    expect(formatEventDate("2026-11-05T10:00:00.000Z", true, "de")).toBe(
      "05.11.2026 · Uhrzeit folgt",
    );
  });
  it("zeigt sonst Datum und Uhrzeit", () => {
    expect(formatEventDate("2026-11-05T10:00:00.000Z", false, "de")).toMatch(
      /05\.11\.2026, \d\d:00/,
    );
  });
});

describe("tbdIso / tbdDateInput", () => {
  it("Datum geht beim Hin- und Rückweg nicht verloren", () => {
    expect(tbdDateInput(tbdIso("2026-11-05", "start"))).toBe("2026-11-05");
    expect(tbdDateInput(tbdIso("2026-11-05", "end"))).toBe("2026-11-05");
  });
  it("Ende liegt nach dem Start am selben Tag", () => {
    expect(tbdIso("2026-11-05", "end") > tbdIso("2026-11-05", "start")).toBe(true);
  });
});
