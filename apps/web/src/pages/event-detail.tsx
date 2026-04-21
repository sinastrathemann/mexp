import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { apiFetch } from "../api/client";
import { useAuth } from "../auth/auth-context";
import { BudgetPanel } from "../events/budget-panel";
import { ParticipantsPanel } from "../events/participants-panel";
import { type EventDto, type EventStatus, allowedTransitions } from "../events/types";

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const { hasRole } = useAuth();
  const qc = useQueryClient();
  const canManage = hasRole("admin", "manager", "event_office");

  const { data, isLoading, error } = useQuery({
    queryKey: ["events", id, "detail"],
    queryFn: () => apiFetch<{ event: EventDto }>(`/events/${id}`),
    enabled: Boolean(id),
  });

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

  if (isLoading) return <p style={{ padding: "2rem" }}>{t("auth.loading")}</p>;
  if (error instanceof Error)
    return <p style={{ padding: "2rem", color: "#b00020" }}>{error.message}</p>;
  if (!data) return null;

  const event = data.event;
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString(i18n.language === "de" ? "de-DE" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  const next = allowedTransitions(event.status);

  return (
    <div style={{ padding: "2rem", fontFamily: "system-ui", maxWidth: 900 }}>
      <Link to="/events">← {t("events.backToList")}</Link>
      <h1 style={{ marginTop: "0.5rem" }}>{event.title}</h1>
      <p style={{ color: "#555" }}>
        {t(`events.type.${event.eventType}`)} · {t(`events.status.${event.status}`)} ·{" "}
        {t(`events.visibility.${event.visibility}`)}
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "150px 1fr",
          gap: "0.5rem 1rem",
          marginTop: "1.5rem",
          border: "1px solid #ddd",
          borderRadius: 8,
          padding: "1.5rem",
        }}
      >
        <strong>{t("events.fieldStart")}</strong>
        <span>{fmtDate(event.startAt)}</span>
        <strong>{t("events.fieldEnd")}</strong>
        <span>{fmtDate(event.endAt)}</span>
        <strong>{t("events.fieldLocation")}</strong>
        <span>{event.location ?? "—"}</span>
        <strong>{t("events.fieldCapacity")}</strong>
        <span>{event.capacity ?? "—"}</span>
        <strong>{t("events.fieldDescription")}</strong>
        <span style={{ whiteSpace: "pre-wrap" }}>{event.description || "—"}</span>
      </div>

      {canManage && next.length > 0 && (
        <div style={{ marginTop: "1.5rem" }}>
          <h2 style={{ fontSize: "1.1rem" }}>{t("events.statusActions")}</h2>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {next.map((status) => (
              <button
                key={status}
                type="button"
                disabled={transitionMut.isPending}
                onClick={() => transitionMut.mutate(status)}
                style={{ padding: "0.5rem 1rem" }}
              >
                → {t(`events.status.${status}`)}
              </button>
            ))}
          </div>
          {transitionMut.error instanceof Error && (
            <p style={{ color: "#b00020" }}>{transitionMut.error.message}</p>
          )}
        </div>
      )}

      <ParticipantsPanel event={event} />
      <BudgetPanel event={event} />
    </div>
  );
}
