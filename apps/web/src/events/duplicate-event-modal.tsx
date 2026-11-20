import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api/client";
import { localDay, shiftEventDates } from "./duplicate-dates";
import type { EventDto } from "./types";

/**
 * Feedback-Runde 6 (Punkt 15): Event duplizieren. Übernimmt Inhalte, Formular,
 * Aufgaben (zurückgesetzt) und Planungsdaten — nur Titel und Datum werden hier gesetzt.
 */
export function DuplicateEventModal({ event, onClose }: { event: EventDto; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [title, setTitle] = useState(`${event.title} (${t("events.duplicateCopySuffix")})`);
  const [day, setDay] = useState(localDay(event.startAt));

  const mut = useMutation({
    mutationFn: () =>
      apiFetch<{ event: EventDto }>(`/events/${event.id}/duplicate`, {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          ...shiftEventDates(event.startAt, event.endAt, day),
        }),
      }),
    onSuccess: ({ event: copy }) => {
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["year-plan"] });
      onClose();
      navigate(`/events/${copy.id}`);
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    mut.mutate();
  };

  return createPortal(
    <div
      className="modal-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(10, 10, 10, 0.55)",
        backdropFilter: "blur(4px)",
        zIndex: 9999,
        padding: 24,
        overflow: "auto",
      }}
    >
      <form
        className="modal"
        onSubmit={submit}
        style={{
          maxWidth: 520,
          width: "100%",
          background: "#ffffff",
          borderRadius: 12,
          padding: 32,
          boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
        }}
      >
        <div className="card-header" style={{ marginBottom: "var(--space-2)" }}>
          <div>
            <div className="eyebrow">{t("events.duplicateAction")}</div>
            <h2 className="card-title" style={{ marginTop: 4 }}>
              {event.title}
            </h2>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            ×
          </button>
        </div>
        <p className="muted text-sm">{t("events.duplicateHint")}</p>
        <label className="field" style={{ marginTop: "var(--space-3)" }}>
          <span>{t("events.duplicateTitle")}</span>
          <input
            className="input"
            required
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="field" style={{ marginTop: "var(--space-3)" }}>
          <span>{t("events.duplicateDate")}</span>
          <input
            className="input"
            type="date"
            required
            value={day}
            onChange={(e) => setDay(e.target.value)}
          />
        </label>
        {mut.error instanceof Error && (
          <div className="alert alert-error" style={{ marginTop: "var(--space-3)" }}>
            {mut.error.message}
          </div>
        )}
        <div className="row" style={{ gap: 8, marginTop: "var(--space-4)", justifyContent: "end" }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t("events.duplicateCancel")}
          </button>
          <button type="submit" className="btn btn-primary" disabled={mut.isPending || !day}>
            {t("events.duplicateSubmit")}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
