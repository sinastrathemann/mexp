import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Feedback-Runde 6 (Punkt 12): Folgefragen klappen erst auf, wenn die auslösende
// Frage passend beantwortet ist (showIf).
process.env.MEXP_DATA_DIR = mkdtempSync(join(tmpdir(), "mexp-conditional-"));
Reflect.deleteProperty(process.env, "DATABASE_URL");

const { validateAnswers, normalizeAnswers, visibleQuestionIds } = await import(
  "../src/routes/registration-form.js"
);
type Question = Parameters<typeof validateAnswers>[0][number];

const hotel: Question = {
  id: "q-hotel",
  order: 0,
  type: "yes_no",
  label: "Brauchst du ein Hotel?",
  required: true,
  options: [],
};
const nights: Question = {
  id: "q-nights",
  order: 1,
  type: "single_choice",
  label: "Wie viele Nächte?",
  required: true,
  options: ["1", "2"],
  showIf: { questionId: "q-hotel", equals: true },
};
const roommate: Question = {
  id: "q-room",
  order: 2,
  type: "free_text",
  label: "Mit wem teilst du?",
  required: true,
  options: [],
  showIf: { questionId: "q-nights", equals: "2" },
};
const form = [hotel, nights, roommate];

describe("Folgefragen (showIf)", () => {
  it("Folgefrage ist bei passender Antwort sichtbar und Pflicht", () => {
    const res = validateAnswers(form, [{ questionId: "q-hotel", value: true }]);
    expect(res.ok).toBe(false);
    expect(visibleQuestionIds(form, [{ questionId: "q-hotel", value: true }])).toEqual(
      new Set(["q-hotel", "q-nights"]),
    );
  });

  it("bei anderer Antwort zugeklappt und keine Pflicht", () => {
    expect(validateAnswers(form, [{ questionId: "q-hotel", value: false }]).ok).toBe(true);
  });

  it("Kette: ausgeblendete Zwischenfrage blendet auch Folgefrage aus", () => {
    const answers = [
      { questionId: "q-hotel", value: false },
      { questionId: "q-nights", value: "2" },
    ];
    expect(visibleQuestionIds(form, answers)).toEqual(new Set(["q-hotel"]));
    expect(validateAnswers(form, answers).ok).toBe(true);
  });

  it("Antworten auf ausgeblendete Fragen werden verworfen", () => {
    const answers = [
      { questionId: "q-hotel", value: false },
      { questionId: "q-nights", value: "2" },
    ];
    expect(normalizeAnswers(answers, form).map((a) => a.questionId)).toEqual(["q-hotel"]);
  });

  it("Mehrfachauswahl: sichtbar, wenn der Wert mit ausgewählt ist", () => {
    const food: Question = {
      id: "q-food",
      order: 0,
      type: "multi_choice",
      label: "Was isst du?",
      required: false,
      options: ["Fleisch", "Vegan"],
    };
    const allergy: Question = {
      id: "q-allergy",
      order: 1,
      type: "free_text",
      label: "Allergien?",
      required: false,
      options: [],
      showIf: { questionId: "q-food", equals: "Vegan" },
    };
    expect(
      visibleQuestionIds([food, allergy], [{ questionId: "q-food", value: ["Fleisch", "Vegan"] }]),
    ).toEqual(new Set(["q-food", "q-allergy"]));
  });

  it("Fragen ohne showIf verhalten sich wie bisher", () => {
    expect(visibleQuestionIds([hotel], [])).toEqual(new Set(["q-hotel"]));
    expect(normalizeAnswers([{ questionId: "q-hotel", value: true }])).toHaveLength(1);
  });
});
