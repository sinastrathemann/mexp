import { describe, expect, it } from "vitest";
import { activeQuestions, buildAnswers, checkAnswers, withOther } from "./answer-utils";
import type { RegistrationQuestion } from "./types";

const city: RegistrationQuestion = {
  id: "q1",
  order: 0,
  type: "single_choice",
  label: "Stadt",
  required: true,
  options: ["Bielefeld", "München"],
  allowOther: true,
};

describe("checkAnswers", () => {
  it("Pflichtfrage ist mit Freitext bei 'Andere' beantwortet", () => {
    expect(checkAnswers([city], {}, { q1: "Köln" })).toBeNull();
  });
  it("'Andere' gewählt ohne Text → Fehler", () => {
    expect(checkAnswers([city], {}, { q1: " " })).toContain("Andere");
  });
  it("Pflichtfrage ohne Antwort → Fehler", () => {
    expect(checkAnswers([city], {}, {})).toContain("Bitte beantworte");
  });
});

describe("buildAnswers", () => {
  it("übernimmt getrimmten Freitext", () => {
    expect(buildAnswers([city], {}, { q1: " Köln " })).toEqual([
      { questionId: "q1", value: null, otherText: "Köln" },
    ]);
  });
  it("ignoriert Freitext bei Fragen ohne allowOther", () => {
    expect(
      buildAnswers([{ ...city, allowOther: false }], { q1: "München" }, { q1: "Köln" }),
    ).toEqual([{ questionId: "q1", value: "München" }]);
  });
});

describe("withOther", () => {
  it("hängt 'Andere' an", () => {
    expect(withOther("München", "Köln")).toBe("München, Andere: Köln");
    expect(withOther("—", "Köln")).toBe("Andere: Köln");
    expect(withOther("München", null)).toBe("München");
  });
});

describe("activeQuestions", () => {
  const dabei: RegistrationQuestion = {
    id: "q0",
    order: 0,
    type: "yes_no",
    label: "Bist du dabei?",
    required: true,
    options: [],
    attendance: true,
  };

  it("bei 'Nein' entfallen die übrigen Fragen (auch Pflichtfragen)", () => {
    const shown = activeQuestions([dabei, city], { q0: false });
    expect(shown).toEqual([dabei]);
    expect(checkAnswers(shown, { q0: false }, {})).toBeNull();
  });

  it("bei 'Ja' oder ohne Antwort bleiben alle Fragen", () => {
    expect(activeQuestions([dabei, city], { q0: true })).toHaveLength(2);
    expect(activeQuestions([dabei, city], {})).toHaveLength(2);
  });
});
