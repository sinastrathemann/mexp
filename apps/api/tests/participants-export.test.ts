import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { buildParticipantsWorkbook } from "../src/participants-export.js";

describe("buildParticipantsWorkbook", () => {
  it("schreibt nummerierte Zeilen inkl. Formularantworten und lässt Formeln als Text", async () => {
    const buffer = await buildParticipantsWorkbook(
      "Sommerfest",
      [
        {
          userDisplayName: "Anna Becker",
          userEmail: "anna@example.com",
          status: "registered",
          waitlistPosition: null,
          registeredAt: "2026-10-01T08:00:00.000Z",
          cancelledAt: null,
          answers: [{ questionId: "q1", value: true }],
        },
        {
          userDisplayName: "=HYPERLINK(\"x\")",
          userEmail: "tim@example.com",
          status: "cancelled",
          waitlistPosition: null,
          registeredAt: "2026-10-02T08:00:00.000Z",
          cancelledAt: "2026-10-03T08:00:00.000Z",
        },
      ],
      [{ id: "q1", label: "Vegetarisch?" }],
    );

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const sheet = wb.getWorksheet("Teilnehmer");
    expect(sheet?.getRow(1).getCell(9).value).toBe("Vegetarisch?");
    expect(sheet?.getRow(2).getCell(1).value).toBe(1);
    expect(sheet?.getRow(2).getCell(9).value).toBe("Ja");
    expect(sheet?.getRow(3).getCell(2).value).toBe('=HYPERLINK("x")');
    expect(sheet?.getRow(3).getCell(4).value).toBe("Abgemeldet");
  });
});
