import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { apiFetch } from "../api/client";
import { useAuth } from "../auth/auth-context";
import { EventStatusBadge } from "../events/status-badge";
import type { EventDto } from "../events/types";

export default function EventsListPage() {
  const { t, i18n } = useTranslation();
  const { hasRole } = useAuth();
  const canCreate = hasRole("admin", "manager", "event_office", "werkstudent");

  const { data, isLoading, error } = useQuery({
    queryKey: ["events", "list"],
    queryFn: () => apiFetch<{ events: EventDto[] }>("/events"),
  });

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString(i18n.language === "de" ? "de-DE" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });

  const total = data?.events.length ?? 0;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="eyebrow">
            Events · {total.toString().padStart(2, "0")} aktiv
          </div>
          <h1 className="page-title">{t("events.listTitle")}</h1>
          <p className="page-subtitle">
            mindsquare Events, Büro-, Feelgood-, Team-, Strategie-, Bereichsevents & Local Experiences im Überblick
          </p>
        </div>
        {canCreate && (
          <Link to="/events/new" className="btn btn-primary btn-lg">
            + {t("events.create")}
          </Link>
        )}
      </div>

      {isLoading && <div className="card">{t("auth.loading")}</div>}
      {error instanceof Error && <div className="alert alert-error">{error.message}</div>}

      {data && data.events.length === 0 && (
        <div
          className="card"
          style={{
            textAlign: "center",
            padding: "var(--space-16) var(--space-6)",
            color: "var(--fg-muted)",
          }}
        >
          <div className="bento-eyebrow">Noch nichts hier</div>
          <h3 style={{ marginTop: "var(--space-3)" }}>{t("events.empty")}</h3>
        </div>
      )}

      {data && data.events.length > 0 && (
        <div className="event-grid">
          {data.events.map((e) => (
            <Link
              key={e.id}
              to={`/events/${e.id}`}
              className="event-card"
              data-status={e.status}
            >
              <div className="event-card-head">
                <span className="event-card-type">{t(`events.type.${e.eventType}`)}</span>
                <EventStatusBadge status={e.status} />
              </div>

              <h2 className="event-card-title">{e.title}</h2>

              <div className="event-card-meta">
                <div className="event-card-meta-row">
                  <span className="event-card-meta-label">Start</span>
                  <span className="event-card-meta-value">{fmtDate(e.startAt)}</span>
                </div>
                <div className="event-card-meta-row">
                  <span className="event-card-meta-label">Ort</span>
                  <span className="event-card-meta-value">{e.location ?? "—"}</span>
                </div>
                {e.capacity !== null && e.capacity !== undefined && (
                  <div className="event-card-meta-row">
                    <span className="event-card-meta-label">Plätze</span>
                    <span className="event-card-meta-value text-mono">{e.capacity}</span>
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
