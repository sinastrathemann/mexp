import type { ParticipantDto, RegistrationQuestion } from "./types";

interface Row {
  key: string;
  label: string;
  names: string[];
}

function fmtSlot(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" });
}

// Pro Antwortmöglichkeit: wer hat sie gewählt (Mehrfachauswahl zählt je Option)
function rowsFor(q: RegistrationQuestion, participants: ParticipantDto[]): Row[] {
  const answerOf = (p: ParticipantDto) => p.answers?.find((a) => a.questionId === q.id)?.value;
  if (q.type === "yes_no") {
    return [
      { key: "yes", label: "Ja", value: true },
      { key: "no", label: "Nein", value: false },
    ].map((o) => ({
      key: o.key,
      label: o.label,
      names: participants.filter((p) => answerOf(p) === o.value).map((p) => p.userDisplayName),
    }));
  }
  return q.options.map((opt) => ({
    key: opt,
    label: q.type === "date_pick" ? fmtSlot(opt) : opt,
    names: participants
      .filter((p) => {
        const v = answerOf(p);
        return Array.isArray(v) ? v.includes(opt) : v === opt;
      })
      .map((p) => p.userDisplayName),
  }));
}

// Ergebnisse der Fragen, deren Antworten das Event-Team für alle freigegeben hat
export function PublicAnswerResults({
  questions,
  participants,
}: {
  questions: RegistrationQuestion[];
  participants: ParticipantDto[];
}) {
  const shown = questions.filter((q) => q.answersPublic && q.type !== "free_text");
  if (shown.length === 0) return null;
  // Abgemeldete zählen nicht mehr mit
  const voters = participants.filter((p) => p.status !== "cancelled");

  return (
    <div className="answer-results">
      {shown.map((q) => {
        const rows = rowsFor(q, voters);
        const max = Math.max(1, ...rows.map((r) => r.names.length));
        return (
          <div key={q.id} className="answer-results-question">
            <div className="answer-results-title">{q.label}</div>
            {rows.map((r) => (
              <div key={r.key} className="answer-results-row">
                <span className="answer-results-label">{r.label}</span>
                <span className="answer-results-bar" aria-hidden="true">
                  <span style={{ width: `${(r.names.length / max) * 100}%` }} />
                </span>
                <span className="answer-results-count">{r.names.length}</span>
                <span className="answer-results-names muted text-sm">
                  {r.names.join(", ") || "—"}
                </span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
