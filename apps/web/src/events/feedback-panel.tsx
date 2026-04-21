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
  ratingContent: number | null;
  ratingOrganization: number | null;
  comment: string;
}

const initialForm: FormState = {
  ratingOverall: 5,
  ratingContent: null,
  ratingOrganization: null,
  comment: "",
};

export function FeedbackPanel({ event }: FeedbackPanelProps) {
  const { t } = useTranslation();
  const { hasRole } = useAuth();
  const qc = useQueryClient();
  const canManage = hasRole("admin", "manager", "event_office");
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
    submitMut.mutate({
      ratingOverall: form.ratingOverall,
      ratingContent: form.ratingContent,
      ratingOrganization: form.ratingOrganization,
      comment: form.comment.trim() === "" ? null : form.comment.trim(),
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
            <div>
              <span className="label" style={{ display: "inline", marginRight: 8 }}>
                {t("feedback.fieldOverall")}
              </span>
              {stars(ownQ.data.feedback.ratingOverall)}
            </div>
            {ownQ.data.feedback.ratingContent !== null && (
              <div>
                <span className="label" style={{ display: "inline", marginRight: 8 }}>
                  {t("feedback.fieldContent")}
                </span>
                {stars(ownQ.data.feedback.ratingContent)}
              </div>
            )}
            {ownQ.data.feedback.ratingOrganization !== null && (
              <div>
                <span className="label" style={{ display: "inline", marginRight: 8 }}>
                  {t("feedback.fieldOrganization")}
                </span>
                {stars(ownQ.data.feedback.ratingOrganization)}
              </div>
            )}
            {ownQ.data.feedback.comment && (
              <p style={{ whiteSpace: "pre-wrap", color: "var(--fg-strong)" }}>
                {ownQ.data.feedback.comment}
              </p>
            )}
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="card-flat"
            style={{ marginTop: "var(--space-3)" }}
          >
            <RatingField
              label={t("feedback.fieldOverall")}
              required
              value={form.ratingOverall}
              onChange={(v) => setForm({ ...form, ratingOverall: v ?? 5 })}
            />
            <RatingField
              label={t("feedback.fieldContent")}
              value={form.ratingContent}
              onChange={(v) => setForm({ ...form, ratingContent: v })}
            />
            <RatingField
              label={t("feedback.fieldOrganization")}
              value={form.ratingOrganization}
              onChange={(v) => setForm({ ...form, ratingOrganization: v })}
            />
            <div className="field">
              <label className="label" htmlFor="fb-comment">
                {t("feedback.fieldComment")}
              </label>
              <textarea
                id="fb-comment"
                className="textarea"
                value={form.comment}
                onChange={(e) => setForm({ ...form, comment: e.target.value })}
                rows={3}
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
          <div className="stat-grid">
            <Kpi label={t("feedback.kpiCount")} value={String(allQ.data.stats.count)} />
            <Kpi
              label={t("feedback.kpiAvgOverall")}
              value={fmtAvg(allQ.data.stats.averageOverall)}
            />
            <Kpi
              label={t("feedback.kpiAvgContent")}
              value={fmtAvg(allQ.data.stats.averageContent)}
            />
            <Kpi
              label={t("feedback.kpiAvgOrganization")}
              value={fmtAvg(allQ.data.stats.averageOrganization)}
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
                      marginBottom: "var(--space-1)",
                    }}
                  >
                    {new Date(fb.submittedAt).toLocaleString()}
                  </div>
                  <div>
                    <span className="label" style={{ display: "inline", marginRight: 8 }}>
                      {t("feedback.fieldOverall")}
                    </span>
                    {stars(fb.ratingOverall)}
                  </div>
                  {fb.ratingContent !== null && (
                    <div>
                      <span className="label" style={{ display: "inline", marginRight: 8 }}>
                        {t("feedback.fieldContent")}
                      </span>
                      {stars(fb.ratingContent)}
                    </div>
                  )}
                  {fb.ratingOrganization !== null && (
                    <div>
                      <span className="label" style={{ display: "inline", marginRight: 8 }}>
                        {t("feedback.fieldOrganization")}
                      </span>
                      {stars(fb.ratingOrganization)}
                    </div>
                  )}
                  {fb.comment && (
                    <p
                      style={{
                        whiteSpace: "pre-wrap",
                        margin: "var(--space-2) 0 0",
                        color: "var(--fg-strong)",
                      }}
                    >
                      {fb.comment}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
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
        alignItems: "center",
        gap: "var(--space-2)",
        marginBottom: "var(--space-3)",
      }}
    >
      <legend
        style={{
          minWidth: 160,
          padding: 0,
          float: "left",
          fontSize: "var(--label-size)",
          fontWeight: "var(--label-weight)",
          color: "var(--fg-subtle)",
          letterSpacing: "var(--tracking-wide)",
          textTransform: "uppercase",
        }}
      >
        {label}
      </legend>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          style={{
            border: "none",
            background: "transparent",
            cursor: "pointer",
            fontSize: "1.35rem",
            color: value !== null && n <= value ? "var(--brand-yellow)" : "var(--border-strong)",
            padding: "0 2px",
          }}
          aria-label={`${n}`}
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
    </fieldset>
  );
}
