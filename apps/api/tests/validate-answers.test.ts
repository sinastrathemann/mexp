import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

process.env.MEXP_DATA_DIR = mkdtempSync(join(tmpdir(), "mexp-validate-answers-"));
Reflect.deleteProperty(process.env, "DATABASE_URL");

const { validateAnswers } = await import("../src/routes/registration-form.js");
type Question = Parameters<typeof validateAnswers>[0][number];

const city: Question = {
  id: "q-city",
  order: 0,
  type: "single_choice",
  label: "Standort",
  required: true,
  options: ["Bielefeld", "München"],
  allowOther: true,
};

describe("validateAnswers mit Option 'Andere'", () => {
  it("Freitext ohne feste Option erfüllt die Pflichtfrage", () => {
    const res = validateAnswers([city], [{ questionId: "q-city", value: null, otherText: "Köln" }]);
    expect(res.ok).toBe(true);
  });

  it("feste Option weiterhin gültig", () => {
    const res = validateAnswers([city], [{ questionId: "q-city", value: "Bielefeld" }]);
    expect(res.ok).toBe(true);
  });

  it("Freitext bei Frage ohne allowOther wird abgelehnt", () => {
    const res = validateAnswers(
      [{ ...city, allowOther: false }],
      [{ questionId: "q-city", value: null, otherText: "Köln" }],
    );
    expect(res.ok).toBe(false);
  });

  it("Mehrfachauswahl: feste Optionen plus Freitext", () => {
    const res = validateAnswers(
      [{ ...city, type: "multi_choice" }],
      [{ questionId: "q-city", value: ["München"], otherText: "Köln" }],
    );
    expect(res.ok).toBe(true);
  });

  it("Freitext über 200 Zeichen wird abgelehnt", () => {
    const res = validateAnswers(
      [city],
      [{ questionId: "q-city", value: null, otherText: "x".repeat(201) }],
    );
    expect(res.ok).toBe(false);
  });

  it("leerer Freitext zählt nicht als Antwort", () => {
    const res = validateAnswers([city], [{ questionId: "q-city", value: null, otherText: "  " }]);
    expect(res.ok).toBe(false);
  });
});
