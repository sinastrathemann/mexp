import { describe, expect, it } from "vitest";
import { publicAnswerText } from "./public-answers";
import type { ParticipantDto, RegistrationAnswer, RegistrationQuestion } from "./types";

const city: RegistrationQuestion = {
  id: "q1",
  order: 0,
  type: "single_choice",
  label: "Welche Stadt?",
  required: true,
  options: ["Hamburg", "Berlin"],
  allowOther: true,
  answersPublic: true,
};

const person = (answers: RegistrationAnswer[]): ParticipantDto => ({
  id: "p1",
  eventId: "e1",
  userId: "u1",
  userDisplayName: "Anna",
  status: "registered",
  waitlistPosition: null,
  registeredAt: "2026-11-01T10:00:00Z",
  cancelledAt: null,
  checkedInAt: null,
  answers,
});

describe("publicAnswerText", () => {
  it("zeigt die gewählte Option", () => {
    expect(publicAnswerText([city], person([{ questionId: "q1", value: "Hamburg" }]))).toBe(
      "Hamburg",
    );
  });

  it("zeigt die eigene Angabe bei 'Andere'", () => {
    expect(
      publicAnswerText([city], person([{ questionId: "q1", value: null, otherText: "Köln" }])),
    ).toBe("Köln");
  });

  it("zeigt nichts bei nicht freigegebenen Fragen", () => {
    const hidden = { ...city, answersPublic: false };
    expect(publicAnswerText([hidden], person([{ questionId: "q1", value: "Hamburg" }]))).toBe("");
  });
});
