import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../api/client";
import type { EventDto, ParticipantDto } from "./types";

export function KeyFiguresCard({ event }: { event: EventDto }) {
  const { t } = useTranslation();
  // Gleicher Query-Key wie ParticipantsPanel → kein zusätzlicher Request.
  const q = useQuery({
    queryKey: ["events", event.id, "participants"],
    queryFn: () => apiFetch<{ participants: ParticipantDto[] }>(`/events/${event.id}/participants`),
  });
  const registered = (q.data?.participants ?? []).filter(
    (p) => p.status === "registered" || p.status === "attended",
  ).length;
  return (
    <div className="card">
      <h2 className="card-title">{t("projectPlan.keyFiguresTitle")}</h2>
      <div style={{ marginTop: "var(--space-2)" }}>
        👥 {t("projectPlan.registrations")}: <strong>{registered}</strong>
        {event.capacity ? ` / ${event.capacity}` : ""}
      </div>
    </div>
  );
}
