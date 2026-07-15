import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../api/client";
import { useAuth } from "../auth/auth-context";
import type { EventDto, EventFeedbackDto, EventFeedbackStatsDto } from "./types";

interface FeedbackPanelProps {
  event: EventDto;
}

interface FormState {
  ratingOverall: number;
  highlightText: string;
  improvementText: string;
  otherText: string;
}

const initialForm: FormState = {
  ratingOverall: 5,
  highlightText: "",
  improvementText: "",
  otherText: "",
};

const Q1 = "Wie hat dir das Event gefallen?";
const Q2 = "Was war dein Highlight oder hat dir besonders gut gefallen?";
const Q3 = "Was hat dir nicht gefallen? Was können wir besser machen?";
const Q4 = "Sonstige Anmerkungen";

export function FeedbackPanel({ event }: FeedbackPanelProps) {
  const { t } = useTranslation();
  const { hasRole } = useAuth();
  const qc = useQueryClient();
  const canManage = hasRole("admin", "manager", "event_office", "werkstudent");
  const canSubmit = event.status === "running" || event.status === "closed";
  const [form, setForm] = useState<FormState>(initialForm);

  const ownQ = useQuery({
    queryKey: ["events", event.id, "feedback", "mine"],
    queryFn: () =>
      apiFetch<{ feedback: EventFeedbackDto | null }>(`/events/${event.id}/feedback/mine`),
    enabled: canSubmit,
  });

  const allQ = useQuery({
    queryKey: ["events", event.id, "feedback", "all"],
    queryFn: () =>
      apiFetch<{ feedback: EventFeedbackDto[]; stats: EventFeedbackStatsDto }>(
        `/events/${event.id}/feedback`,
      ),
    enabled: canManage,
  });

  const submitMut = useMutation({
    mutationFn: (body: unknown) =>
      apiFetch<{ feedback: EventFeedbackDto }>(`/events/${event.id}/feedback`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      setForm(initialForm);
      qc.invalidateQueries({ queryKey: ["events", event.id, "feedback"] });
    },
  });

  const summaryMut = useMutation({
    mutationFn: () =>
      apiFetch<{ summary: string; provider: string; model: string; count: number }>(
        `/events/${event.id}/feedback/summary`,
        { method: "POST" },
      ),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimOrNull = (s: string) => (s.trim() === "" ? null : s.trim());
    submitMut.mutate({
      ratingOverall: form.ratingOverall,
      highlightText: trimOrNull(form.highlightText),
      improvementText: trimOrNull(form.improvementText),
      otherText: trimOrNull(form.otherText),
    });
  };

  if (!canSubmit && !canManage) return null;

  const fmtAvg = (v: number | null) => (v === null ? "—" : v.toFixed(2));

  return (
    <section className="card">
      <h2 className="card-title">{t("feedback.title")}</h2>

      {canSubmit &&
        (ownQ.data?.feedback ? (
          <div className="card-flat" style={{ marginTop: "var(--space-3)" }}>
            <p className="muted" style={{ marginTop: 0 }}>
              {t("feedback.alreadySubmitted")}
            </p>
            <FeedbackView fb={ownQ.data.feedback} />
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="card-flat"
            style={{ marginTop: "var(--space-3)" }}
          >
            <RatingField
              label={`1. ${Q1}`}
              required
              value={form.ratingOverall}
              onChange={(v) => setForm({ ...form, ratingOverall: v ?? 5 })}
            />

            <div className="field">
              <label className="label" htmlFor="fb-highlight">
                2. {Q2}
              </label>
              <textarea
                id="fb-highlight"
                className="textarea"
                value={form.highlightText}
                onChange={(e) => setForm({ ...form, highlightText: e.target.value })}
                rows={3}
                placeholder="Was war richtig gut?"
              />
            </div>

            <div className="field">
              <label className="label" htmlFor="fb-improvement">
                3. {Q3}
              </label>
              <textarea
                id="fb-improvement"
                className="textarea"
                value={form.improvementText}
                onChange={(e) => setForm({ ...form, improvementText: e.target.value })}
                rows={3}
                placeholder="Konstruktive Kritik hilft uns weiter"
              />
            </div>

            <div className="field">
              <label className="label" htmlFor="fb-other">
                4. {Q4}
              </label>
              <textarea
                id="fb-other"
                className="textarea"
                value={form.otherText}
                onChange={(e) => setForm({ ...form, otherText: e.target.value })}
                rows={2}
                placeholder="Optional"
              />
            </div>

            <div className="form-actions">
              <button type="submit" disabled={submitMut.isPending} className="btn btn-primary">
                {t("feedback.submit")}
              </button>
              {submitMut.error instanceof Error && (
                <span className="err-msg">{submitMut.error.message}</span>
              )}
            </div>
          </form>
        ))}

      {canManage && allQ.data && (
        <div style={{ marginTop: "var(--space-4)" }}>
          <div className="stat-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
            <Kpi label={t("feedback.kpiCount")} value={String(allQ.data.stats.count)} />
            <Kpi
              label={t("feedback.kpiAvgOverall")}
              value={fmtAvg(allQ.data.stats.averageOverall)}
            />
          </div>
          {allQ.data.feedback.length > 0 && (
            <div style={{ marginBottom: "var(--space-4)" }}>
              <button
                type="button"
                onClick={() => summaryMut.mutate()}
                disabled={summaryMut.isPending}
                className="btn btn-yellow btn-sm"
              >
                {summaryMut.isPending ? t("feedback.summarizing") : t("feedback.summarize")}
              </button>
              {summaryMut.data && (
                <div
                  style={{
                    marginTop: "var(--space-3)",
                    padding: "var(--space-4)",
                    background: "var(--brand-yellow-light)",
                    borderLeft: "4px solid var(--brand-yellow)",
                    borderRadius: "var(--radius-base)",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  <div
                    style={{
                      fontSize: "var(--text-xs)",
                      color: "var(--fg-muted)",
                      marginBottom: "var(--space-2)",
                      letterSpacing: "var(--tracking-wide)",
                      textTransform: "uppercase",
                      fontWeight: "var(--weight-bold)",
                    }}
                  >
                    {summaryMut.data.provider} · {summaryMut.data.model} · {t("feedback.kpiCount")}:{" "}
                    {summaryMut.data.count}
                  </div>
                  {summaryMut.data.summary}
                </div>
              )}
              {summaryMut.error instanceof Error && (
                <div className="alert alert-error" style={{ marginTop: "var(--space-3)" }}>
                  {summaryMut.error.message}
                </div>
              )}
            </div>
          )}
          {allQ.data.feedback.length === 0 ? (
            <p className="muted">{t("feedback.empty")}</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "var(--space-2)" }}>
              {allQ.data.feedback.map((fb) => (
                <li key={fb.id} className="card-flat" style={{ margin: 0 }}>
                  <div
                    style={{
                      fontSize: "var(--text-xs)",
                      color: "var(--fg-muted)",
                      marginBottom: "var(--space-2)",
                    }}
                  >
                    {new Date(fb.submittedAt).toLocaleString()}
                  </div>
                  <FeedbackView fb={fb} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function FeedbackView({ fb }: { fb: EventFeedbackDto }) {
  return (
    <div style={{ display: "grid", gap: "var(--space-3)" }}>
      <div>
        <span className="label" style={{ display: "inline", marginRight: 8 }}>
          {Q1}
        </span>
        <span style={{ color: "var(--brand-yellow)", fontSize: "1.1rem", letterSpacing: 2 }}>
          {stars(fb.ratingOverall)}
        </span>
      </div>
      {fb.highlightText && (
        <Answer label={Q2} value={fb.highlightText} />
      )}
      {fb.improvementText && (
        <Answer label={Q3} value={fb.improvementText} />
      )}
      {fb.otherText && (
        <Answer label={Q4} value={fb.otherText} />
      )}
    </div>
  );
}

function Answer({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="label" style={{ marginBottom: 4 }}>
        {label}
      </div>
      <p style={{ whiteSpace: "pre-wrap", margin: 0, color: "var(--fg-strong)" }}>{value}</p>
    </div>
  );
}

function stars(n: number): string {
  return "★".repeat(n) + "☆".repeat(5 - n);
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <div className="stat-value" style={{ fontSize: "var(--text-xl)" }}>
        {value}
      </div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

interface RatingFieldProps {
  label: string;
  value: number | null;
  required?: boolean;
  onChange: (v: number | null) => void;
}

function RatingField({ label, value, required, onChange }: RatingFieldProps) {
  return (
    <fieldset
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
        marginBottom: "var(--space-4)",
      }}
    >
      <legend
        style={{
          padding: 0,
          fontSize: "var(--label-size)",
          fontWeight: "var(--label-weight)",
          color: "var(--fg-strong)",
          fontFamily: "var(--font-mono)",
          letterSpacing: "var(--tracking-wider)",
          textTransform: "uppercase",
        }}
      >
        {label}
      </legend>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: "1.75rem",
              color: value !== null && n <= value ? "var(--brand-yellow)" : "var(--border-strong)",
              padding: "0 4px",
              transition: "transform 120ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.15)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
            }}
            aria-label={`${n} Sterne`}
          >
            ★
          </button>
        ))}
        {!required && value !== null && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="btn btn-ghost btn-sm"
            style={{ marginLeft: "var(--space-2)" }}
          >
            ×
          </button>
        )}
      </div>
    </fieldset>
  );
}
