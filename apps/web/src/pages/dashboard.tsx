import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../api/client";
import {
  EVENT_STATUSES,
  type EventStatus,
  PARTICIPATION_STATUSES,
  type ParticipationStatus,
} from "../events/types";

interface PortfolioStatsDto {
  eventsByStatus: Record<EventStatus, number>;
  participationByStatus: Record<ParticipationStatus, number>;
  upcomingEventsCount: number;
  attendanceRate: number | null;
  noShowRate: number | null;
  totalEvents: number;
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard", "portfolio"],
    queryFn: () => apiFetch<{ stats: PortfolioStatsDto }>("/dashboard/portfolio"),
  });

  if (isLoading) return <p style={{ padding: "2rem" }}>{t("auth.loading")}</p>;
  if (error instanceof Error)
    return <p style={{ padding: "2rem", color: "#b00020" }}>{error.message}</p>;
  if (!data) return null;

  const s = data.stats;
  const fmtPct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)} %`);

  return (
    <div style={{ padding: "2rem", fontFamily: "system-ui", maxWidth: 1100 }}>
      <h1>{t("dashboard.title")}</h1>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem" }}>
        <KpiCard label={t("dashboard.totalEvents")} value={String(s.totalEvents)} />
        <KpiCard label={t("dashboard.upcomingEvents")} value={String(s.upcomingEventsCount)} />
        <KpiCard label={t("dashboard.attendanceRate")} value={fmtPct(s.attendanceRate)} />
        <KpiCard label={t("dashboard.noShowRate")} value={fmtPct(s.noShowRate)} />
      </section>

      <section style={{ marginTop: "2rem" }}>
        <h2 style={{ fontSize: "1.1rem" }}>{t("dashboard.eventsByStatus")}</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "0.5rem" }}>
          {EVENT_STATUSES.map((es) => (
            <MiniCard key={es} label={t(`events.status.${es}`)} value={s.eventsByStatus[es] ?? 0} />
          ))}
        </div>
      </section>

      <section style={{ marginTop: "2rem" }}>
        <h2 style={{ fontSize: "1.1rem" }}>{t("dashboard.participationByStatus")}</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "0.5rem" }}>
          {PARTICIPATION_STATUSES.map((ps) => (
            <MiniCard
              key={ps}
              label={t(`participants.status.${ps}`)}
              value={s.participationByStatus[ps] ?? 0}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: "1rem" }}>
      <div style={{ fontSize: "0.85rem", color: "#777" }}>{label}</div>
      <div style={{ fontSize: "2rem", fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function MiniCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ border: "1px solid #eee", borderRadius: 6, padding: "0.75rem" }}>
      <div style={{ fontSize: "0.8rem", color: "#777" }}>{label}</div>
      <div style={{ fontSize: "1.3rem", fontWeight: 600 }}>{value}</div>
    </div>
  );
}
