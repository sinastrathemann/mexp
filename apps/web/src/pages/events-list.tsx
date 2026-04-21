import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { apiFetch } from "../api/client";
import { useAuth } from "../auth/auth-context";
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
    <div style={{ padding: "2rem", fontFamily: "system-ui", maxWidth: 1100 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>{t("events.listTitle")}</h1>
        {canCreate && (
          <Link
            to="/events/new"
            style={{
              padding: "0.5rem 1rem",
              background: "#1d4ed8",
              color: "white",
              borderRadius: 6,
              textDecoration: "none",
            }}
          >
            {t("events.create")}
          </Link>
        )}
      </div>

      {isLoading && <p>{t("auth.loading")}</p>}
      {error instanceof Error && <p style={{ color: "#b00020" }}>{error.message}</p>}

      {data && data.events.length === 0 && <p>{t("events.empty")}</p>}
      {data && data.events.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "1rem" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "2px solid #333" }}>
              <th style={{ padding: "0.5rem" }}>{t("events.colTitle")}</th>
              <th style={{ padding: "0.5rem" }}>{t("events.colType")}</th>
              <th style={{ padding: "0.5rem" }}>{t("events.colStart")}</th>
              <th style={{ padding: "0.5rem" }}>{t("events.colStatus")}</th>
              <th style={{ padding: "0.5rem" }}>{t("events.colLocation")}</th>
            </tr>
          </thead>
          <tbody>
            {data.events.map((e) => (
              <tr key={e.id} style={{ borderBottom: "1px solid #ddd" }}>
                <td style={{ padding: "0.5rem" }}>
                  <Link to={`/events/${e.id}`}>{e.title}</Link>
                </td>
                <td style={{ padding: "0.5rem" }}>{t(`events.type.${e.eventType}`)}</td>
                <td style={{ padding: "0.5rem" }}>{fmtDate(e.startAt)}</td>
                <td style={{ padding: "0.5rem" }}>
                  <StatusBadge status={e.status} />
                </td>
                <td style={{ padding: "0.5rem" }}>{e.location ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const colors: Record<string, string> = {
    draft: "#6b7280",
    planned: "#2563eb",
    open: "#059669",
    running: "#d97706",
    closed: "#4b5563",
    cancelled: "#b91c1c",
  };
  return (
    <span
      style={{
        padding: "0.15rem 0.5rem",
        borderRadius: 4,
        background: colors[status] ?? "#6b7280",
        color: "white",
        fontSize: "0.8rem",
      }}
    >
      {t(`events.status.${status}`)}
    </span>
  );
}
