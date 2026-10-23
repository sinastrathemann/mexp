import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";
import { useAuth } from "../auth/auth-context";
import { RegistrationModal } from "./registration-modal";
import type { EventDto, QuestionType, RegistrationQuestion } from "./types";

interface Props {
  event: EventDto;
}

const TYPE_LABEL: Record<QuestionType, string> = {
  yes_no: "Ja / Nein",
  single_choice: "Einfachauswahl",
  multi_choice: "Mehrfachauswahl",
  date_pick: "Termin-Abstimmung",
  free_text: "Freitext",
};

const QUESTION_TEMPLATES: { label: string; build: () => Omit<RegistrationQuestion, "id"> }[] = [
  {
    label: "+ Bist du dabei?",
    build: () => ({
      order: 0,
      type: "yes_no",
      label: "Bist du dabei?",
      required: true,
      options: [],
    }),
  },
  {
    label: "+ Verpflegung",
    build: () => ({
      order: 0,
      type: "single_choice",
      label: "Welche Verpflegung passt dir?",
      required: true,
      options: ["Omnivor", "Vegetarisch", "Vegan"],
    }),
  },
  {
    label: "+ Allergien",
    build: () => ({
      order: 0,
      type: "multi_choice",
      label: "Hast du Allergien oder Unverträglichkeiten?",
      required: false,
      options: ["Gluten", "Laktose", "Nüsse", "Histamin"],
    }),
  },
  {
    label: "+ Freitext",
    build: () => ({
      order: 0,
      type: "free_text",
      label: "Möchtest du uns noch etwas mitteilen?",
      required: false,
      options: [],
    }),
  },
  {
    label: "+ Terminabstimmung",
    build: () => ({
      order: 0,
      type: "date_pick",
      label: "An welchen Terminen kannst du?",
      required: true,
      options: [],
    }),
  },
];

// Leere Fragen: Text und Antwortmöglichkeiten legt das Event-Team selbst fest
const BLANK_QUESTIONS: { label: string; build: () => Omit<RegistrationQuestion, "id"> }[] = [
  {
    label: "+ Einfachauswahl",
    build: () => ({
      order: 0,
      type: "single_choice",
      label: "",
      required: false,
      options: ["", ""],
    }),
  },
  {
    label: "+ Mehrfachauswahl",
    build: () => ({
      order: 0,
      type: "multi_choice",
      label: "",
      required: false,
      options: ["", ""],
    }),
  },
  {
    label: "+ Ja / Nein",
    build: () => ({ order: 0, type: "yes_no", label: "", required: false, options: [] }),
  },
  {
    label: "+ Terminabstimmung",
    build: () => ({ order: 0, type: "date_pick", label: "", required: false, options: [""] }),
  },
];

export function RegistrationFormPanel({ event }: Props) {
  const { hasRole } = useAuth();
  const qc = useQueryClient();
  const canEdit = hasRole("admin", "manager", "event_office", "werkstudent");

  const formQ = useQuery({
    queryKey: ["events", event.id, "registration-form"],
    queryFn: () =>
      apiFetch<{ questions: RegistrationQuestion[] }>(`/events/${event.id}/registration-form`),
  });

  const [questions, setQuestions] = useState<RegistrationQuestion[]>([]);
  const [dirty, setDirty] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (formQ.data?.questions) {
      setQuestions(formQ.data.questions);
      setDirty(false);
    }
  }, [formQ.data]);

  const saveMut = useMutation({
    mutationFn: (qs: RegistrationQuestion[]) =>
      apiFetch<{ questions: RegistrationQuestion[] }>(`/events/${event.id}/registration-form`, {
        method: "PUT",
        body: JSON.stringify({ questions: qs }),
      }),
    onSuccess: () => {
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["events", event.id, "registration-form"] });
    },
  });

  if (!canEdit) return null;

  // Client-seitige Vorab-Validierung — verhindert hängende Saves
  const clientValidationError = (() => {
    for (const q of questions) {
      if (!q.label.trim()) return "Eine Frage hat keinen Text.";
      if (
        (q.type === "single_choice" || q.type === "multi_choice" || q.type === "date_pick") &&
        q.options.length === 0
      ) {
        return `"${q.label}": Mindestens eine Option erforderlich`;
      }
      if (
        (q.type === "single_choice" || q.type === "multi_choice" || q.type === "date_pick") &&
        q.options.some((o) => !o.trim())
      ) {
        return `"${q.label}": Leere Option entfernen oder ausfüllen`;
      }
    }
    return null;
  })();

  const updateQuestion = (id: string, patch: Partial<RegistrationQuestion>) => {
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q)));
    setDirty(true);
  };

  const removeQuestion = (id: string) => {
    setQuestions((qs) => qs.filter((q) => q.id !== id));
    setDirty(true);
  };

  const addQuestion = (template: { build: () => Omit<RegistrationQuestion, "id"> }) => {
    const base = template.build();
    const newQ: RegistrationQuestion = {
      ...base,
      id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      order: questions.length,
    };
    setQuestions((qs) => [...qs, newQ]);
    setDirty(true);
  };

  const move = (id: string, dir: -1 | 1) => {
    setQuestions((qs) => {
      const idx = qs.findIndex((q) => q.id === id);
      if (idx < 0) return qs;
      const target = idx + dir;
      if (target < 0 || target >= qs.length) return qs;
      const next = [...qs];
      [next[idx], next[target]] = [
        next[target] as RegistrationQuestion,
        next[idx] as RegistrationQuestion,
      ];
      return next.map((q, i) => ({ ...q, order: i }));
    });
    setDirty(true);
  };

  return (
    <section className="card">
      <div className="card-header">
        <div>
          <h2 className="card-title">Anmelde-Formular</h2>
          <p className="muted text-sm" style={{ margin: "4px 0 0" }}>
            Welche Fragen müssen Teilnehmer bei der Anmeldung beantworten? (Xoyondo-Style)
          </p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {dirty && (
            <span className="badge badge-yellow" style={{ alignSelf: "center" }}>
              Ungespeichert
            </span>
          )}
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={questions.length === 0 || clientValidationError !== null}
            onClick={() => setPreviewOpen(true)}
            title={
              clientValidationError ?? (questions.length === 0 ? "Zuerst Fragen hinzufügen" : "")
            }
          >
            👁 Vorschau
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!dirty || saveMut.isPending || clientValidationError !== null}
            onClick={() => saveMut.mutate(questions)}
            title={clientValidationError ?? ""}
          >
            {saveMut.isPending ? "Speichere…" : "Speichern"}
          </button>
        </div>
      </div>

      {previewOpen && (
        <RegistrationModal
          eventTitle={event.title}
          questions={questions}
          pending={false}
          previewMode={true}
          onCancel={() => setPreviewOpen(false)}
          onSubmit={() => setPreviewOpen(false)}
        />
      )}

      {clientValidationError && (
        <div className="alert alert-warning" style={{ marginTop: "var(--space-3)" }}>
          ⚠ {clientValidationError}
        </div>
      )}
      {saveMut.error instanceof Error && (
        <div className="alert alert-error">{saveMut.error.message}</div>
      )}
      {saveMut.isSuccess && !dirty && (
        <div className="alert alert-info" style={{ marginTop: "var(--space-3)" }}>
          ✓ Anmelde-Formular gespeichert.
        </div>
      )}

      {questions.length === 0 ? (
        <p className="muted">
          Noch keine Fragen. Standardmäßig melden sich Teilnehmer ohne Zusatzfragen an.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {questions.map((q, idx) => (
            <QuestionEditor
              key={q.id}
              question={q}
              onChange={(patch) => updateQuestion(q.id, patch)}
              onRemove={() => removeQuestion(q.id)}
              onMoveUp={idx > 0 ? () => move(q.id, -1) : undefined}
              onMoveDown={idx < questions.length - 1 ? () => move(q.id, 1) : undefined}
            />
          ))}
        </div>
      )}

      <div
        style={{
          marginTop: "var(--space-4)",
          paddingTop: "var(--space-4)",
          borderTop: "1px solid var(--border-default)",
        }}
      >
        <div className="label" style={{ marginBottom: "var(--space-2)" }}>
          Eigene Frage
        </div>
        <div className="muted text-xs" style={{ marginBottom: 6 }}>
          Leere Frage – Text und Antwortmöglichkeiten selbst festlegen
        </div>
        <div className="row" style={{ gap: 8, flexWrap: "wrap", marginBottom: "var(--space-4)" }}>
          {BLANK_QUESTIONS.map((tpl) => (
            <button
              key={tpl.label}
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => addQuestion(tpl)}
            >
              {tpl.label}
            </button>
          ))}
        </div>
        <div className="label" style={{ marginBottom: "var(--space-2)" }}>
          Schnell hinzufügen
        </div>
        <div
          className="row"
          style={{ gap: "var(--space-5)", flexWrap: "wrap", alignItems: "flex-start" }}
        >
          <div>
            <div className="muted text-xs" style={{ marginBottom: 6 }}>
              Mit vorgegebenen Antwortmöglichkeiten
            </div>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              {QUESTION_TEMPLATES.filter((tpl) => tpl.build().type !== "free_text").map((tpl) => (
                <button
                  key={tpl.label}
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => addQuestion(tpl)}
                >
                  {tpl.label}
                </button>
              ))}
            </div>
          </div>
          <div
            style={{
              paddingLeft: "var(--space-5)",
              borderLeft: "1px solid var(--border-default)",
            }}
          >
            <div className="muted text-xs" style={{ marginBottom: 6 }}>
              Freie Antwort (ohne Optionen)
            </div>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              {QUESTION_TEMPLATES.filter((tpl) => tpl.build().type === "free_text").map((tpl) => (
                <button
                  key={tpl.label}
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => addQuestion(tpl)}
                >
                  {tpl.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

interface EditorProps {
  question: RegistrationQuestion;
  onChange: (patch: Partial<RegistrationQuestion>) => void;
  onRemove: () => void;
  onMoveUp: (() => void) | undefined;
  onMoveDown: (() => void) | undefined;
}

function QuestionEditor({ question, onChange, onRemove, onMoveUp, onMoveDown }: EditorProps) {
  const isChoice = question.type === "single_choice" || question.type === "multi_choice";
  const isDate = question.type === "date_pick";

  const updateOption = (idx: number, value: string) => {
    const next = [...question.options];
    next[idx] = value;
    onChange({ options: next });
  };
  const removeOption = (idx: number) => {
    onChange({ options: question.options.filter((_, i) => i !== idx) });
  };
  const addOption = (value = "") => {
    onChange({ options: [...question.options, value] });
  };

  return (
    <div
      className="card-flat"
      style={{ margin: 0, padding: "var(--space-4)", background: "var(--bg-subtle)" }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: "var(--space-3)",
          alignItems: "start",
        }}
      >
        <div>
          <div className="row" style={{ gap: 8, marginBottom: 8 }}>
            <span
              className={question.type === "free_text" ? "badge badge-cobalt" : "badge badge-ink"}
            >
              {TYPE_LABEL[question.type]}
            </span>
            <label
              className="text-mono text-xs muted"
              style={{ display: "inline-flex", gap: 6, alignItems: "center" }}
            >
              <input
                type="checkbox"
                checked={question.required}
                onChange={(e) => onChange({ required: e.target.checked })}
              />
              Pflichtfeld
            </label>
          </div>

          <input
            className="input"
            type="text"
            value={question.label}
            placeholder="Frage-Text"
            onChange={(e) => onChange({ label: e.target.value })}
            style={{ marginBottom: 8 }}
          />

          {question.type === "free_text" && (
            <div>
              <p className="help-text" style={{ margin: "0 0 6px" }}>
                Teilnehmende schreiben ihre Antwort selbst – hier gibt es keine
                Antwortmöglichkeiten. Für feste Optionen eine Einfach- oder Mehrfachauswahl
                verwenden.
              </p>
              <textarea
                className="textarea"
                rows={2}
                disabled
                placeholder="Antwortfeld für die teilnehmende Person"
                style={{ borderStyle: "dashed" }}
              />
            </div>
          )}

          {(isChoice || isDate) && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {question.options.map((opt, idx) => (
                // Index statt Optionstext als Key, sonst verliert das Feld bei jedem Tastendruck den Fokus
                // biome-ignore lint/suspicious/noArrayIndexKey: Optionen haben keine stabile ID
                <div key={`option-${idx}`} className="row" style={{ gap: 6 }}>
                  <input
                    className="input"
                    type={isDate ? "datetime-local" : "text"}
                    value={isDate ? toLocalInput(opt) : opt}
                    placeholder={isDate ? "" : `Option ${idx + 1}`}
                    onChange={(e) =>
                      updateOption(idx, isDate ? toIso(e.target.value) : e.target.value)
                    }
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => removeOption(idx)}
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => addOption()}
                style={{ alignSelf: "flex-start" }}
              >
                {isDate ? "+ Datums-Slot" : "+ Option"}
              </button>
              {isChoice && (
                <label
                  className="text-sm"
                  style={{ display: "inline-flex", gap: 6, alignItems: "center", marginTop: 4 }}
                >
                  <input
                    type="checkbox"
                    checked={question.allowOther === true}
                    onChange={(e) => onChange({ allowOther: e.target.checked })}
                  />
                  „Andere“ mit Freitext erlauben
                  <span className="muted text-xs">
                    – Teilnehmende können eine eigene Antwort eintragen
                  </span>
                </label>
              )}
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {onMoveUp && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onMoveUp}
              title="Nach oben"
            >
              ↑
            </button>
          )}
          {onMoveDown && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onMoveDown}
              title="Nach unten"
            >
              ↓
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onRemove}
            title="Entfernen"
            style={{ color: "var(--brand-orange)" }}
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}

function toLocalInput(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toIso(local: string): string {
  if (!local) return "";
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return local;
  return d.toISOString();
}
