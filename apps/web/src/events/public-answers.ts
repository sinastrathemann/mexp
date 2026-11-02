import type { ParticipantDto, RegistrationQuestion } from "./types";

function fmtSlot(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });
}

// Freigegebene Antworten einer Person als kurzer Text für die Namensliste,
// z. B. "Hamburg" oder "Hamburg · 12.12.26, 18:00". Leer, wenn nichts freigegeben/beantwortet.
export function publicAnswerText(
  questions: RegistrationQuestion[],
  participant: ParticipantDto,
): string {
  const parts: string[] = [];
  for (const q of questions) {
    if (!q.answersPublic || q.type === "free_text") continue;
    const v = participant.answers?.find((a) => a.questionId === q.id)?.value;
    if (v === undefined || v === null || v === "") continue;
    if (typeof v === "boolean") parts.push(v ? "Ja" : "Nein");
    else if (Array.isArray(v)) {
      if (v.length > 0)
        parts.push(v.map((o) => (q.type === "date_pick" ? fmtSlot(o) : o)).join(", "));
    } else parts.push(v);
  }
  return parts.join(" · ");
}
