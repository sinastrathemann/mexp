import type { AnswerValue, RegistrationAnswer, RegistrationQuestion } from "./types";

// Antworten im Anmeldefenster: Wert je Frage plus Freitext zu "Andere".
// others[id] === undefined → "Andere" nicht gewählt; String (auch leer) → gewählt.
export type AnswerValues = Record<string, AnswerValue>;
export type OtherTexts = Record<string, string | undefined>;

function isEmpty(v: AnswerValue | undefined): boolean {
  return v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
}

// Formulare von vor dem Teilnahme-Häkchen: die Vorlage "Bist du dabei?" gilt weiter als Teilnahme-Frage
export function isAttendanceQuestion(q: RegistrationQuestion): boolean {
  if (q.type !== "yes_no") return false;
  return q.attendance ?? q.label.trim() === "Bist du dabei?";
}

// Wer bei einer Teilnahme-Frage "Nein" sagt, muss die übrigen Fragen nicht mehr beantworten
export function declinesAttendance(
  questions: RegistrationQuestion[],
  values: AnswerValues,
): boolean {
  return questions.some((q) => isAttendanceQuestion(q) && values[q.id] === false);
}

/**
 * Runde 6: Folgefragen (showIf) klappen erst auf, wenn die auslösende Frage passend
 * beantwortet ist — Spiegel von visibleQuestionIds() in der API.
 */
export function conditionMet(q: RegistrationQuestion, values: AnswerValues): boolean {
  if (!q.showIf) return true;
  const v = values[q.showIf.questionId];
  return Array.isArray(v) ? v.includes(String(q.showIf.equals)) : v === q.showIf.equals;
}

export function activeQuestions(
  questions: RegistrationQuestion[],
  values: AnswerValues,
): RegistrationQuestion[] {
  const base = declinesAttendance(questions, values)
    ? questions.filter(isAttendanceQuestion)
    : questions;
  const visible = new Set<string>();
  return base.filter((q) => {
    const ok = conditionMet(q, values) && (!q.showIf || visible.has(q.showIf.questionId));
    if (ok) visible.add(q.id);
    return ok;
  });
}

// Liefert die erste Fehlermeldung oder null, wenn alles passt
export function checkAnswers(
  questions: RegistrationQuestion[],
  values: AnswerValues,
  others: OtherTexts,
): string | null {
  for (const q of questions) {
    const other = others[q.id];
    if (other !== undefined && other.trim() === "") {
      return `Bitte gib bei „Andere“ etwas ein: "${q.label}"`;
    }
    const answered = !isEmpty(values[q.id]) || (other !== undefined && other.trim() !== "");
    if (q.required && !answered) return `Bitte beantworte: "${q.label}"`;
  }
  return null;
}

function defaultValue(q: RegistrationQuestion): AnswerValue {
  if (q.type === "yes_no" || q.type === "single_choice" || q.type === "free_text") return null;
  return [];
}

export function buildAnswers(
  questions: RegistrationQuestion[],
  values: AnswerValues,
  others: OtherTexts,
): RegistrationAnswer[] {
  return questions.map((q) => {
    const other = q.allowOther ? others[q.id]?.trim() : undefined;
    const answer: RegistrationAnswer = { questionId: q.id, value: values[q.id] ?? defaultValue(q) };
    if (other) answer.otherText = other;
    return answer;
  });
}

// Anzeige einer Antwort inkl. "Andere: …"
export function withOther(text: string, otherText: string | null | undefined): string {
  if (!otherText) return text;
  const other = `Andere: ${otherText}`;
  return text && text !== "—" ? `${text}, ${other}` : other;
}
