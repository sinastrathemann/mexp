import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../api/client";
import { useAuth } from "../auth/auth-context";
import { withBasePath } from "../base-path";
import { RichText } from "../components/rich-text";
import { BudgetLinkCard } from "../events/budget-link-card";
import { DocumentsPanel } from "../events/documents-panel";
import { EventContentCard } from "../events/event-content-card";
import { formatEventDate } from "../events/event-date";
import { EventEditModal } from "../events/event-edit-modal";
import { eventTypeLabel } from "../events/event-type-label";
import { FeedbackPanel } from "../events/feedback-panel";
import { KeyFiguresCard } from "../events/key-figures-card";
import { ParticipantsPanel } from "../events/participants-panel";
import { PhaseBar } from "../events/phase-bar";
import { PlanMetaCard } from "../events/plan-meta-card";
import { RegistrationFormPanel } from "../events/registration-form-panel";
import { registrationState } from "../events/registration-state";
import { EventStatusBadge } from "../events/status-badge";
import { TaskChecklist } from "../events/task-checklist";
import { TenderPanel } from "../events/tender-panel";
import { ToolsCard } from "../events/tools-card";
import type { EventDto, EventStatus, ParticipationDto } from "../events/types";

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const { hasRole } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const canManage = hasRole("admin", "manager", "event_office", "werkstudent");
  // Budget-Owner sieht nur den Link ins Budget-Control-Tool (Team-Rollen: rechte Spalte)
  const showBudgetOnly = !canManage && hasRole("budget_owner");

  const { data, isLoading, error } = useQuery({
    queryKey: ["events", id, "detail"],
    queryFn: () => apiFetch<{ event: EventDto }>(`/events/${id}`),
    enabled: Boolean(id),
  });

  // Eigener Anmeldestatus — gleicher Query-Key wie im Teilnehmer-Panel, damit der
  // Banner oben sich beim An-/Abmelden sofort mit aktualisiert.
  const myParticipationQ = useQuery({
    queryKey: ["events", id, "my-participation"],
    queryFn: () =>
      apiFetch<{ participation: ParticipationDto | null }>(`/events/${id}/my-participation`),
    enabled: Boolean(id),
  });
  const myStatus = myParticipationQ.data?.participation?.status;
  const myWaitlistPosition = myParticipationQ.data?.participation?.waitlistPosition;

  const [editOpen, setEditOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Link, der das Event direkt mit geöffnetem Anmeldeformular zeigt
  const copyRegistrationLink = async () => {
    const url = `${window.location.origin}${withBasePath(`/events/${id}?anmelden=1`)}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt(t("events.copyRegistrationLink"), url);
      return;
    }
    setLinkCopied(true);
    window.setTimeout(() => setLinkCopied(false), 2000);
  };

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
      // zurück zur Liste — über den Router, damit der Basispfad (/mexp) erhalten bleibt
      navigate("/events");
    },
  });

  const archiveMut = useMutation({
    mutationFn: (archive: boolean) =>
      apiFetch<{ event: EventDto }>(`/events/${id}/${archive ? "archive" : "unarchive"}`, {
        method: "POST",
      }),
    onSuccess: () => {
      // Archivierte Events fehlen auch in den Dashboards
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["my"] });
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
  // Runde 5: Projekte = Projektplan ohne Anmeldung/Teilnehmer
  const isProject = event.kind === "project";
  const fmtDate = (iso: string) => formatEventDate(iso, event.timeTbd, i18n.language);

  return (
    <div className="page">
      <Link to="/events" className="btn btn-ghost btn-sm" style={{ marginLeft: -12 }}>
        ← {t("events.backToList")}
      </Link>
      <div className="page-header" style={{ marginTop: "var(--space-3)" }}>
        <div>
          <div className="eyebrow">{eventTypeLabel(event, t)}</div>
          <h1 className="page-title">{event.title}</h1>
          <div className="row" style={{ marginTop: "var(--space-2)" }}>
            <EventStatusBadge status={event.status} project={isProject} />
            {event.archived && <span className="badge badge-orange">{t("events.archived")}</span>}
            <span className="badge badge-muted">{t(`events.visibility.${event.visibility}`)}</span>
            {event.audienceScope === "teams" && (event.audienceTeams?.length ?? 0) > 0 && (
              <span className="badge badge-muted">
                Zielgruppe: {(event.audienceTeams ?? []).join(", ")}
              </span>
            )}
            {event.audienceScope === "departments" &&
              (event.audienceDepartments?.length ?? 0) > 0 && (
                <span className="badge badge-muted">
                  Zielgruppe: {(event.audienceDepartments ?? []).join(", ")}
                </span>
              )}
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <a
            href={withBasePath(`/api/events/${event.id}/calendar.ics`)}
            className="btn btn-outline"
            title="Lädt eine .ics-Datei herunter, die in Outlook, Apple Calendar oder Google Calendar geöffnet werden kann."
          >
            📅 In Kalender speichern
          </a>
          {canManage && !isProject && (
            <button type="button" className="btn btn-outline" onClick={copyRegistrationLink}>
              {linkCopied ? `✓ ${t("events.linkCopied")}` : t("events.copyRegistrationLink")}
            </button>
          )}
          {canManage && (
            <button type="button" className="btn btn-outline" onClick={() => setEditOpen(true)}>
              ✎ Bearbeiten
            </button>
          )}
          {hasRole("admin") && (
            <button
              type="button"
              className="btn btn-outline"
              disabled={archiveMut.isPending}
              onClick={() => {
                if (event.archived) archiveMut.mutate(false);
                else if (window.confirm(t("events.archiveConfirm"))) archiveMut.mutate(true);
              }}
            >
              {event.archived ? t("events.restoreAction") : t("events.archiveAction")}
            </button>
          )}
        </div>
      </div>

      {archiveMut.error instanceof Error && (
        <div className="alert alert-error" style={{ marginBottom: "var(--space-3)" }}>
          {archiveMut.error.message}
        </div>
      )}

      {(myStatus === "registered" || myStatus === "attended") && (
        <output className="registration-status registration-status--banner">
          <span className="registration-status-icon" aria-hidden="true">
            ✓
          </span>
          <span>
            <strong>{t("participants.bannerRegistered")}</strong>
            <span className="muted" style={{ display: "block", fontSize: "var(--text-sm)" }}>
              {fmtDate(event.startAt)}
              {event.location ? ` · ${event.location}` : ""}
            </span>
          </span>
        </output>
      )}
      {myStatus === "waitlisted" && (
        <output className="registration-status registration-status--waitlist registration-status--banner">
          <span className="registration-status-icon" aria-hidden="true">
            {myWaitlistPosition ?? "?"}
          </span>
          <strong>
            {t("participants.yourStatusWaitlisted", { position: myWaitlistPosition ?? "?" })}
          </strong>
        </output>
      )}

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

      {showBudgetOnly && <BudgetLinkCard />}

      {canManage && (
        <>
          <PlanMetaCard event={event} />
          <PhaseBar
            status={event.status}
            pending={transitionMut.isPending}
            project={isProject}
            registrationClosed={
              registrationState(event) === "closed_manual" ||
              registrationState(event) === "closed_deadline"
            }
            onTransition={(status) => transitionMut.mutate(status)}
          />
          {transitionMut.error instanceof Error && (
            <div className="alert alert-error">{transitionMut.error.message}</div>
          )}
          <div className="project-plan-grid">
            <TaskChecklist eventId={event.id} />
            <div className="project-plan-side">
              <ToolsCard />
              {!isProject && <KeyFiguresCard event={event} />}
              <BudgetLinkCard />
            </div>
          </div>
          <EventContentCard eventId={event.id} />
        </>
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
          {!isProject && (
            <>
              <div className="label" style={{ margin: 0 }}>
                {t("events.fieldCapacity")}
              </div>
              <span>{event.capacity ?? "—"}</span>
            </>
          )}
          {!isProject && event.registrationDeadline && (
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
          {event.description ? <RichText value={event.description} /> : <span>—</span>}
        </div>
      </div>

      {!isProject && <RegistrationFormPanel event={event} />}
      {!isProject && <ParticipantsPanel event={event} />}
      <TenderPanel event={event} />
      <DocumentsPanel event={event} />
      {!isProject && <FeedbackPanel event={event} />}
    </div>
  );
}
