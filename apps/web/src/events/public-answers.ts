import type { ParticipantDto, RegistrationQuestion } from "./types";

function fmtSlot(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });
}

// Freigegebene Antworten einer Person als kurzer Text für die Namensliste,
// z. B. "Hamburg", "Köln" (eigene Angabe bei "Andere") oder "Hamburg · 12.12.26, 18:00".
// Leer, wenn nichts freigegeben/beantwortet.
export function publicAnswerText(
  questions: RegistrationQuestion[],
  participant: ParticipantDto,
): string {
  const parts: string[] = [];
  for (const q of questions) {
    if (!q.answersPublic || q.type === "free_text") continue;
    const a = participant.answers?.find((x) => x.questionId === q.id);
    const v = a?.value;
    const chosen: string[] = [];
    if (typeof v === "boolean") chosen.push(v ? "Ja" : "Nein");
    else if (Array.isArray(v))
      chosen.push(...v.map((o) => (q.type === "date_pick" ? fmtSlot(o) : o)));
    else if (v) chosen.push(v);
    const other = a?.otherText?.trim();
    if (other) chosen.push(other);
    if (chosen.length > 0) parts.push(chosen.join(", "));
  }
  return parts.join(" · ");
}
