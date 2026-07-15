import { useState } from "react";
import type { RegistrationAnswer, RegistrationQuestion } from "./types";

interface Props {
  eventTitle: string;
  questions: RegistrationQuestion[];
  pending: boolean;
  error?: string | null;
  previewMode?: boolean;
  initialPersonalNote?: string;
  onCancel: () => void;
  onSubmit: (answers: RegistrationAnswer[], personalNote: string | null) => void;
}

export function RegistrationModal({
  eventTitle,
  questions,
  pending,
  error,
  previewMode = false,
  initialPersonalNote = "",
  onCancel,
  onSubmit,
}: Props) {
  const [values, setValues] = useState<Record<string, boolean | string | string[] | null>>({});
  const [personalNote, setPersonalNote] = useState<string>(initialPersonalNote);
  const [validationError, setValidationError] = useState<string | null>(null);

  const setValue = (id: string, v: boolean | string | string[] | null) => {
    setValues((s) => ({ ...s, [id]: v }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    // Client-Side Validation: Pflichtfelder
    for (const q of questions) {
      const v = values[q.id];
      const empty =
        v === undefined ||
        v === null ||
        v === "" ||
        (Array.isArray(v) && v.length === 0);
      if (q.required && empty) {
        setValidationError(`Bitte beantworte: "${q.label}"`);
        return;
      }
    }
    const answers: RegistrationAnswer[] = questions.map((q) => ({
      questionId: q.id,
      value: (values[q.id] ?? defaultValue(q)) as boolean | string | string[] | null,
    }));
    onSubmit(answers, personalNote.trim() === "" ? null : personalNote.trim());
  };

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="card-header" style={{ marginBottom: "var(--space-2)" }}>
          <div>
            <div className="eyebrow">{previewMode ? "Vorschau · Anmelde-Formular" : "Anmeldung"}</div>
            <h2 className="card-title" style={{ marginTop: 4 }}>
              {eventTitle}
            </h2>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
            ×
          </button>
        </div>
        <p className="muted text-sm" style={{ marginTop: 0 }}>
          {previewMode
            ? "So sieht das Formular aus, wenn Teilnehmer sich anmelden. Eingaben werden nicht gespeichert."
            : "Bitte beantworte die folgenden Fragen, um deine Anmeldung abzuschließen."}
        </p>

        <form onSubmit={handleSubmit} style={{ marginTop: "var(--space-4)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            {questions.map((q) => (
              <QuestionField
                key={q.id}
                question={q}
                value={values[q.id]}
                onChange={(v) => setValue(q.id, v)}
              />
            ))}
          </div>

          <fieldset
            style={{
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-md)",
              padding: "var(--space-3) var(--space-4)",
              margin: "var(--space-4) 0 0",
            }}
          >
            <legend
              style={{
                padding: "0 var(--space-2)",
                fontFamily: "var(--font-mono)",
                fontSize: "var(--label-size)",
                fontWeight: 700,
                letterSpacing: "var(--tracking-wider)",
                textTransform: "uppercase",
                color: "var(--fg-strong)",
              }}
            >
              Persönliche Notiz (optional)
            </legend>
            <textarea
              className="textarea"
              rows={2}
              value={personalNote}
              onChange={(e) => setPersonalNote(e.target.value)}
              placeholder='z. B. "komme mit Partner", "vegetarisch", "kann erst ab 15:30"'
            />
            <p className="help-text" style={{ marginTop: 4 }}>
              Du kannst diese Notiz auch später noch im Event-Detail bearbeiten.
            </p>
          </fieldset>

          {(validationError || error) && (
            <div className="alert alert-error" style={{ marginTop: "var(--space-4)" }}>
              {validationError || error}
            </div>
          )}

          <div className="form-actions" style={{ marginTop: "var(--space-5)" }}>
            {!previewMode && (
              <button type="submit" disabled={pending} className="btn btn-primary">
                {pending ? "Melde an…" : "Anmeldung absenden"}
              </button>
            )}
            <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={pending}>
              {previewMode ? "Schließen" : "Abbrechen"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function defaultValue(q: RegistrationQuestion): boolean | string | string[] | null {
  if (q.type === "yes_no") return null;
  if (q.type === "single_choice") return null;
  return [];
}

interface FieldProps {
  question: RegistrationQuestion;
  value: boolean | string | string[] | null | undefined;
  onChange: (v: boolean | string | string[] | null) => void;
}

function QuestionField({ question, value, onChange }: FieldProps) {
  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
      <legend className="label" style={{ marginBottom: 8 }}>
        {question.label}
        {question.required && <span style={{ color: "var(--brand-orange)" }}> *</span>}
      </legend>

      {question.type === "yes_no" && <YesNoField value={value as boolean | null | undefined} onChange={onChange} />}
      {question.type === "single_choice" && (
        <SingleChoiceField
          options={question.options}
          value={(value ?? null) as string | null}
          onChange={onChange}
        />
      )}
      {question.type === "multi_choice" && (
        <MultiChoiceField
          options={question.options}
          value={(value ?? []) as string[]}
          onChange={onChange}
        />
      )}
      {question.type === "date_pick" && (
        <DatePickField
          options={question.options}
          value={(value ?? []) as string[]}
          onChange={onChange}
        />
      )}
    </fieldset>
  );
}

function YesNoField({
  value,
  onChange,
}: {
  value: boolean | null | undefined;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="row" style={{ gap: 8 }}>
      <button
        type="button"
        className={value === true ? "btn btn-primary" : "btn btn-outline"}
        onClick={() => onChange(true)}
      >
        ✓ Ja, bin dabei
      </button>
      <button
        type="button"
        className={value === false ? "btn btn-primary" : "btn btn-outline"}
        onClick={() => onChange(false)}
      >
        × Nein
      </button>
    </div>
  );
}

function SingleChoiceField({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          className={value === opt ? "btn btn-primary btn-sm" : "btn btn-outline btn-sm"}
          onClick={() => onChange(opt)}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function MultiChoiceField({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (opt: string) => {
    if (value.includes(opt)) onChange(value.filter((v) => v !== opt));
    else onChange([...value, opt]);
  };
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          className={value.includes(opt) ? "btn btn-primary btn-sm" : "btn btn-outline btn-sm"}
          onClick={() => toggle(opt)}
        >
          {value.includes(opt) ? "✓ " : ""}
          {opt}
        </button>
      ))}
    </div>
  );
}

function DatePickField({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (opt: string) => {
    if (value.includes(opt)) onChange(value.filter((v) => v !== opt));
    else onChange([...value, opt]);
  };
  const fmt = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" });
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <p className="muted text-xs" style={{ margin: "0 0 4px" }}>
        Wähle alle Termine, an denen du kannst:
      </p>
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          className={value.includes(opt) ? "btn btn-primary btn-sm" : "btn btn-outline btn-sm"}
          onClick={() => toggle(opt)}
          style={{ justifyContent: "flex-start" }}
        >
          {value.includes(opt) ? "✓ " : "○ "}
          {fmt(opt)}
        </button>
      ))}
    </div>
  );
}
