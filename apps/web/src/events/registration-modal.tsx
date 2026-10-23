import { useState } from "react";
import { createPortal } from "react-dom";
import { type AnswerValues, type OtherTexts, buildAnswers, checkAnswers } from "./answer-utils";
import type { RegistrationAnswer, RegistrationQuestion } from "./types";

interface Props {
  eventTitle: string;
  questions: RegistrationQuestion[];
  pending: boolean;
  error?: string | null;
  previewMode?: boolean;
  initialPersonalNote?: string;
  // "edit": Admin/Werkstudent:in bearbeitet eine bestehende Anmeldung
  // "self-edit": Teilnehmende ändern ihre eigenen Angaben
  mode?: "register" | "edit" | "self-edit";
  subtitle?: string;
  initialAnswers?: RegistrationAnswer[];
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
  mode = "register",
  subtitle,
  initialAnswers = [],
  onCancel,
  onSubmit,
}: Props) {
  const [values, setValues] = useState<AnswerValues>(() =>
    Object.fromEntries(initialAnswers.map((a) => [a.questionId, a.value])),
  );
  const [others, setOthers] = useState<OtherTexts>(() =>
    Object.fromEntries(
      initialAnswers.filter((a) => a.otherText).map((a) => [a.questionId, a.otherText ?? ""]),
    ),
  );
  const isEdit = mode === "edit";
  const isSelfEdit = mode === "self-edit";
  const isUpdate = isEdit || isSelfEdit;
  const [personalNote, setPersonalNote] = useState<string>(initialPersonalNote);
  const [validationError, setValidationError] = useState<string | null>(null);

  const setValue = (id: string, v: boolean | string | string[] | null) => {
    setValues((s) => ({ ...s, [id]: v }));
  };
  const setOther = (id: string, text: string | undefined) => {
    setOthers((s) => ({ ...s, [id]: text }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    const problem = checkAnswers(questions, values, others);
    if (problem) {
      setValidationError(problem);
      return;
    }
    const answers = buildAnswers(questions, values, others);
    onSubmit(answers, personalNote.trim() === "" ? null : personalNote.trim());
  };

  // Portal an <body>, damit das Fenster unabhängig von der Scroll-Position mittig erscheint
  return createPortal(
    <div
      className="modal-backdrop"
      onClick={onCancel}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          onCancel();
        }
      }}
    >
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="card-header" style={{ marginBottom: "var(--space-2)" }}>
          <div>
            <div className="eyebrow">
              {previewMode
                ? "Vorschau · Anmelde-Formular"
                : isEdit
                  ? "Anmeldung bearbeiten"
                  : isSelfEdit
                    ? "Angaben ändern"
                    : "Anmeldung"}
            </div>
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
            : isEdit
              ? (subtitle ?? "Änderungen werden direkt in der Teilnehmerliste übernommen.")
              : isSelfEdit
                ? "Passe deine Antworten an. Deine Anmeldung und dein Platz bleiben erhalten."
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
                other={others[q.id]}
                onOtherChange={(text) => setOther(q.id, text)}
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
              {isEdit
                ? "Notiz der teilnehmenden Person."
                : "Solange die Anmeldung offen ist, kannst du deine Angaben noch ändern oder dich wieder abmelden."}
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
                {pending
                  ? isUpdate
                    ? "Speichere…"
                    : "Melde an…"
                  : isUpdate
                    ? "Änderungen speichern"
                    : "Anmeldung absenden"}
              </button>
            )}
            <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={pending}>
              {previewMode ? "Schließen" : "Abbrechen"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

interface FieldProps {
  question: RegistrationQuestion;
  value: boolean | string | string[] | null | undefined;
  onChange: (v: boolean | string | string[] | null) => void;
  other: string | undefined;
  onOtherChange: (text: string | undefined) => void;
}

function QuestionField({ question, value, onChange, other, onOtherChange }: FieldProps) {
  const allowOther = question.allowOther === true;
  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
      <legend className="label" style={{ marginBottom: 8 }}>
        {question.label}
        {question.required && <span style={{ color: "var(--brand-orange)" }}> *</span>}
      </legend>

      {question.type === "yes_no" && (
        <YesNoField value={value as boolean | null | undefined} onChange={onChange} />
      )}
      {question.type === "single_choice" && (
        <SingleChoiceField
          options={question.options}
          value={(value ?? null) as string | null}
          onChange={(v) => {
            onChange(v);
            onOtherChange(undefined);
          }}
          otherSelected={other !== undefined}
          onSelectOther={
            allowOther
              ? () => {
                  onChange(null);
                  onOtherChange(other ?? "");
                }
              : undefined
          }
        />
      )}
      {question.type === "multi_choice" && (
        <MultiChoiceField
          options={question.options}
          value={(value ?? []) as string[]}
          onChange={onChange}
          otherSelected={other !== undefined}
          onToggleOther={
            allowOther ? () => onOtherChange(other === undefined ? "" : undefined) : undefined
          }
        />
      )}
      {allowOther && other !== undefined && (
        <input
          className="input"
          type="text"
          maxLength={200}
          value={other}
          placeholder="Deine Antwort"
          aria-label={`${question.label}: Andere`}
          onChange={(e) => onOtherChange(e.target.value)}
          style={{ marginTop: 8 }}
        />
      )}
      {question.type === "free_text" && (
        // Freie Antwort optisch von den Auswahl-Buttons abgesetzt
        <div
          style={{
            padding: "var(--space-3)",
            border: "1px dashed var(--border-strong)",
            borderRadius: "var(--radius-md)",
            background: "var(--bg-subtle)",
          }}
        >
          <div className="muted text-xs" style={{ marginBottom: 6 }}>
            Deine Antwort (freier Text)
          </div>
          <textarea
            className="textarea"
            rows={3}
            maxLength={2000}
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
          />
        </div>
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
  otherSelected,
  onSelectOther,
}: {
  options: string[];
  value: string | null;
  onChange: (v: string) => void;
  otherSelected: boolean;
  onSelectOther: (() => void) | undefined;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          className={
            value === opt && !otherSelected ? "btn btn-primary btn-sm" : "btn btn-outline btn-sm"
          }
          onClick={() => onChange(opt)}
        >
          {opt}
        </button>
      ))}
      {onSelectOther && (
        <button
          type="button"
          className={otherSelected ? "btn btn-primary btn-sm" : "btn btn-outline btn-sm"}
          onClick={onSelectOther}
        >
          Andere …
        </button>
      )}
    </div>
  );
}

function MultiChoiceField({
  options,
  value,
  onChange,
  otherSelected,
  onToggleOther,
}: {
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
  otherSelected: boolean;
  onToggleOther: (() => void) | undefined;
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
      {onToggleOther && (
        <button
          type="button"
          className={otherSelected ? "btn btn-primary btn-sm" : "btn btn-outline btn-sm"}
          onClick={onToggleOther}
        >
          {otherSelected ? "✓ " : ""}Andere …
        </button>
      )}
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
