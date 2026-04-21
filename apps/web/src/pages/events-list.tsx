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
  const canCreate = hasRole("admin", "manager", "event_office");

  const { data, isLoading, error } = useQuery({
    queryKey: ["events", "list"],
    queryFn: () => apiFetch<{ events: EventDto[] }>("/events"),
  });

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString(i18n.language === "de" ? "de-DE" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="eyebrow">Events</div>
          <h1 className="page-title">{t("events.listTitle")}</h1>
        </div>
        {canCreate && (
          <Link to="/events/new" className="btn btn-primary">
            + {t("events.create")}
          </Link>
        )}
      </div>

      {isLoading && <div className="card">{t("auth.loading")}</div>}
      {error instanceof Error && <div className="alert alert-error">{error.message}</div>}

      {data && data.events.length === 0 && <div className="card muted">{t("events.empty")}</div>}
      {data && data.events.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="table">
            <thead>
              <tr>
                <th>{t("events.colTitle")}</th>
                <th>{t("events.colType")}</th>
                <th>{t("events.colStart")}</th>
                <th>{t("events.colStatus")}</th>
                <th>{t("events.colLocation")}</th>
              </tr>
            </thead>
            <tbody>
              {data.events.map((e) => (
                <tr key={e.id}>
                  <td>
                    <Link to={`/events/${e.id}`}>{e.title}</Link>
                  </td>
                  <td>{t(`events.type.${e.eventType}`)}</td>
                  <td>{fmtDate(e.startAt)}</td>
                  <td>
                    <EventStatusBadge status={e.status} />
                  </td>
                  <td>{e.location ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
