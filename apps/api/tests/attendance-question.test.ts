import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

process.env.MEXP_DATA_DIR = mkdtempSync(join(tmpdir(), "mexp-attendance-"));
Reflect.deleteProperty(process.env, "DATABASE_URL");

const { declinesAttendance, isAttendanceQuestion } = await import(
  "../src/routes/registration-form.js"
);
type Question = Parameters<typeof isAttendanceQuestion>[0];

const yesNo = (patch: Partial<Question>): Question => ({
  id: "q1",
  order: 0,
  type: "yes_no",
  label: "Bringst du Begleitung mit?",
  required: false,
  options: [],
  ...patch,
});

describe("isAttendanceQuestion", () => {
  it("folgt dem Häkchen", () => {
    expect(isAttendanceQuestion(yesNo({ attendance: true }))).toBe(true);
    expect(isAttendanceQuestion(yesNo({ attendance: false, label: "Bist du dabei?" }))).toBe(false);
  });

  it("alte Formulare: Vorlage 'Bist du dabei?' zählt ohne Häkchen als Teilnahme-Frage", () => {
    expect(isAttendanceQuestion(yesNo({ label: "Bist du dabei?" }))).toBe(true);
    expect(isAttendanceQuestion(yesNo({}))).toBe(false);
  });

  it("gilt nur für Ja/Nein-Fragen", () => {
    expect(isAttendanceQuestion(yesNo({ type: "single_choice", attendance: true }))).toBe(false);
  });
});

describe("declinesAttendance", () => {
  const q = yesNo({ attendance: true });

  it("Nein bei der Teilnahme-Frage = nicht dabei", () => {
    expect(declinesAttendance([q], [{ questionId: "q1", value: false }])).toBe(true);
  });

  it("Ja oder keine Antwort = dabei", () => {
    expect(declinesAttendance([q], [{ questionId: "q1", value: true }])).toBe(false);
    expect(declinesAttendance([q], [])).toBe(false);
  });

  it("Nein bei einer normalen Ja/Nein-Frage ändert nichts", () => {
    expect(declinesAttendance([yesNo({})], [{ questionId: "q1", value: false }])).toBe(false);
  });
});

describe("validateAnswers bei 'nicht dabei'", () => {
  it("Pflichtfrage Stadt entfällt, wenn die Teilnahme-Frage mit Nein beantwortet ist", async () => {
    const { validateAnswers } = await import("../src/routes/registration-form.js");
    const dabei = yesNo({ id: "q0", label: "Bist du dabei?", required: true, attendance: true });
    const city = yesNo({ id: "q1", type: "single_choice", required: true, options: ["Hamburg"] });
    expect(validateAnswers([dabei, city], [{ questionId: "q0", value: false }]).ok).toBe(true);
    expect(validateAnswers([dabei, city], [{ questionId: "q0", value: true }]).ok).toBe(false);
  });
});
