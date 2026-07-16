import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { apiFetch } from "../api/client";
import { useAuth } from "../auth/auth-context";
import { BudgetPanel } from "../events/budget-panel";
import { DocumentsPanel } from "../events/documents-panel";
import { EventEditModal } from "../events/event-edit-modal";
import { FeedbackPanel } from "../events/feedback-panel";
import { ParticipantsPanel } from "../events/participants-panel";
import { RegistrationFormPanel } from "../events/registration-form-panel";
import { EventStatusBadge } from "../events/status-badge";
import { TenderPanel } from "../events/tender-panel";
import { type EventDto, type EventStatus, allowedTransitions } from "../events/types";

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const { hasRole } = useAuth();
  const qc = useQueryClient();
  const canManage = hasRole("admin", "manager", "event_office", "werkstudent");

  const { data, isLoading, error } = useQuery({
    queryKey: ["events", id, "detail"],
    queryFn: () => apiFetch<{ event: EventDto }>(`/events/${id}`),
    enabled: Boolean(id),
  });

  const [editOpen, setEditOpen] = useState(false);

  const transitionMut = useMutation({
    mutationFn: (status: EventStatus) =>
      apiFetch<{ event: EventDto }>(`/events/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"] });
    },
  });

  const editMut = useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      apiFetch<{ event: EventDto }>(`/events/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: () => {
      setEditOpen(false);
      qc.invalidateQueries({ queryKey: ["events"] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: () => apiFetch<{ ok: true }>(`/events/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"] });
      // zurück zur Liste
      window.location.href = "/events";
    },
  });

  if (isLoading) return <div className="page">{t("auth.loading")}</div>;
  if (error instanceof Error)
    return (
      <div className="page">
        <div className="alert alert-error">{error.message}</div>
      </div>
    );
  if (!data) return null;

  const event = data.event;
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString(i18n.language === "de" ? "de-DE" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  const next = allowedTransitions(event.status);

  return (
    <div className="page">
      <Link to="/events" className="btn btn-ghost btn-sm" style={{ marginLeft: -12 }}>
        ← {t("events.backToList")}
      </Link>
      <div className="page-header" style={{ marginTop: "var(--space-3)" }}>
        <div>
          <div className="eyebrow">{t(`events.type.${event.eventType}`)}</div>
          <h1 className="page-title">{event.title}</h1>
          <div className="row" style={{ marginTop: "var(--space-2)" }}>
            <EventStatusBadge status={event.status} />
            <span className="badge badge-muted">{t(`events.visibility.${event.visibility}`)}</span>
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <a
            href={`/api/events/${event.id}/calendar.ics`}
            className="btn btn-outline"
            title="Lädt eine .ics-Datei herunter, die in Outlook, Apple Calendar oder Google Calendar geöffnet werden kann."
          >
            📅 In Kalender speichern
          </a>
          {canManage && (
            <button type="button" className="btn btn-outline" onClick={() => setEditOpen(true)}>
              ✎ Bearbeiten
            </button>
          )}
        </div>
      </div>

      {editOpen && (
        <EventEditModal
          event={event}
          pending={editMut.isPending}
          error={
            editMut.error instanceof Error
              ? editMut.error.message
              : deleteMut.error instanceof Error
                ? deleteMut.error.message
                : null
          }
          canDelete={hasRole("admin")}
          deletePending={deleteMut.isPending}
          onCancel={() => setEditOpen(false)}
          onSubmit={(patch) => editMut.mutate(patch as Record<string, unknown>)}
          onDelete={() => deleteMut.mutate()}
        />
      )}

      <div className="card">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "180px 1fr",
            gap: "var(--space-3) var(--space-4)",
          }}
        >
          <div className="label" style={{ margin: 0 }}>
            {t("events.fieldStart")}
          </div>
          <span>{fmtDate(event.startAt)}</span>
          <div className="label" style={{ margin: 0 }}>
            {t("events.fieldEnd")}
          </div>
          <span>{fmtDate(event.endAt)}</span>
          <div className="label" style={{ margin: 0 }}>
            {t("events.fieldLocation")}
          </div>
          <span>{event.location ?? "—"}</span>
          {event.locationDetails && (
            <>
              <div className="label" style={{ margin: 0 }}>
                Weitere Informationen
              </div>
              <span style={{ whiteSpace: "pre-wrap" }}>{event.locationDetails}</span>
            </>
          )}
          <div className="label" style={{ margin: 0 }}>
            {t("events.fieldCapacity")}
          </div>
          <span>{event.capacity ?? "—"}</span>
          {event.registrationDeadline && (
            <>
              <div className="label" style={{ margin: 0 }}>
                Anmeldung
              </div>
              <span>
                {new Date(event.registrationDeadline).getTime() < Date.now() ? (
                  <span className="badge badge-muted">Anmeldung geschlossen</span>
                ) : (
                  <>Anmeldung noch möglich bis: {fmtDate(event.registrationDeadline)}</>
                )}
              </span>
            </>
          )}
          <div className="label" style={{ margin: 0 }}>
            {t("events.fieldDescription")}
          </div>
          <span style={{ whiteSpace: "pre-wrap" }}>{event.description || "—"}</span>
        </div>
      </div>

      {canManage && next.length > 0 && (
        <div className="card">
          <h2 className="card-title">{t("events.statusActions")}</h2>
          <div className="row" style={{ marginTop: "var(--space-3)" }}>
            {next.map((status) => (
              <button
                key={status}
                type="button"
                disabled={transitionMut.isPending}
                onClick={() => transitionMut.mutate(status)}
                className="btn btn-outline-orange btn-sm"
              >
                → {t(`events.status.${status}`)}
              </button>
            ))}
          </div>
          {transitionMut.error instanceof Error && (
            <div className="alert alert-error" style={{ marginTop: "var(--space-3)" }}>
              {transitionMut.error.message}
            </div>
          )}
        </div>
      )}

      <RegistrationFormPanel event={event} />
      <ParticipantsPanel event={event} />
      <BudgetPanel event={event} />
      <TenderPanel event={event} />
      <DocumentsPanel event={event} />
      <FeedbackPanel event={event} />
    </div>
  );
}
