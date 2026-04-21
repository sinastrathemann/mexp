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
    <section style={{ marginTop: "2rem" }}>
      <h2 style={{ fontSize: "1.1rem" }}>{t("feedback.title")}</h2>

      {canSubmit &&
        (ownQ.data?.feedback ? (
          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: 8,
              padding: "1rem",
              marginBottom: "1rem",
            }}
          >
            <p style={{ marginTop: 0 }}>{t("feedback.alreadySubmitted")}</p>
            <div>
              {t("feedback.fieldOverall")}: {stars(ownQ.data.feedback.ratingOverall)}
            </div>
            {ownQ.data.feedback.ratingContent !== null && (
              <div>
                {t("feedback.fieldContent")}: {stars(ownQ.data.feedback.ratingContent)}
              </div>
            )}
            {ownQ.data.feedback.ratingOrganization !== null && (
              <div>
                {t("feedback.fieldOrganization")}: {stars(ownQ.data.feedback.ratingOrganization)}
              </div>
            )}
            {ownQ.data.feedback.comment && (
              <p style={{ whiteSpace: "pre-wrap", color: "#444" }}>{ownQ.data.feedback.comment}</p>
            )}
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            style={{
              display: "grid",
              gap: "0.5rem",
              border: "1px solid #ddd",
              borderRadius: 8,
              padding: "1rem",
              marginBottom: "1rem",
            }}
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
            <label>
              {t("feedback.fieldComment")}
              <textarea
                value={form.comment}
                onChange={(e) => setForm({ ...form, comment: e.target.value })}
                rows={3}
                style={{ width: "100%" }}
              />
            </label>
            <div>
              <button type="submit" disabled={submitMut.isPending}>
                {t("feedback.submit")}
              </button>
              {submitMut.error instanceof Error && (
                <span style={{ color: "#b00020", marginLeft: "1rem" }}>
                  {submitMut.error.message}
                </span>
              )}
            </div>
          </form>
        ))}

      {canManage && allQ.data && (
        <div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "0.75rem",
              marginBottom: "1rem",
            }}
          >
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
            <div style={{ marginBottom: "1rem" }}>
              <button
                type="button"
                onClick={() => summaryMut.mutate()}
                disabled={summaryMut.isPending}
              >
                {summaryMut.isPending ? t("feedback.summarizing") : t("feedback.summarize")}
              </button>
              {summaryMut.data && (
                <div
                  style={{
                    marginTop: "0.75rem",
                    padding: "0.75rem",
                    background: "#f7f7f7",
                    borderLeft: "3px solid #4a90e2",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  <div style={{ fontSize: "0.8rem", color: "#666", marginBottom: "0.25rem" }}>
                    {summaryMut.data.provider} · {summaryMut.data.model} · {t("feedback.kpiCount")}:{" "}
                    {summaryMut.data.count}
                  </div>
                  {summaryMut.data.summary}
                </div>
              )}
              {summaryMut.error instanceof Error && (
                <p style={{ color: "#b00020" }}>{summaryMut.error.message}</p>
              )}
            </div>
          )}
          {allQ.data.feedback.length === 0 ? (
            <p style={{ color: "#888" }}>{t("feedback.empty")}</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.5rem" }}>
              {allQ.data.feedback.map((fb) => (
                <li
                  key={fb.id}
                  style={{ border: "1px solid #eee", borderRadius: 6, padding: "0.75rem" }}
                >
                  <div style={{ fontSize: "0.85rem", color: "#666" }}>
                    {new Date(fb.submittedAt).toLocaleString()}
                  </div>
                  <div>
                    {t("feedback.fieldOverall")}: {stars(fb.ratingOverall)}
                  </div>
                  {fb.ratingContent !== null && (
                    <div>
                      {t("feedback.fieldContent")}: {stars(fb.ratingContent)}
                    </div>
                  )}
                  {fb.ratingOrganization !== null && (
                    <div>
                      {t("feedback.fieldOrganization")}: {stars(fb.ratingOrganization)}
                    </div>
                  )}
                  {fb.comment && (
                    <p style={{ whiteSpace: "pre-wrap", margin: "0.25rem 0 0", color: "#444" }}>
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
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: "0.5rem 0.75rem" }}>
      <div style={{ color: "#666", fontSize: "0.8rem" }}>{label}</div>
      <div style={{ fontSize: "1.1rem", fontWeight: 600 }}>{value}</div>
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
        gap: "0.5rem",
        border: "none",
        padding: 0,
        margin: 0,
      }}
    >
      <legend style={{ minWidth: 140, padding: 0, float: "left" }}>{label}</legend>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          style={{
            border: "none",
            background: "transparent",
            cursor: "pointer",
            fontSize: "1.3rem",
            color: value !== null && n <= value ? "#f5a623" : "#ccc",
            padding: "0 0.1rem",
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
          style={{ fontSize: "0.8rem", marginLeft: "0.5rem" }}
        >
          ×
        </button>
      )}
    </fieldset>
  );
}
