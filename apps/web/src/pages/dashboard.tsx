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

  if (isLoading) return <div className="page">{t("auth.loading")}</div>;
  if (error instanceof Error)
    return (
      <div className="page">
        <div className="alert alert-error">{error.message}</div>
      </div>
    );
  if (!data) return null;

  const s = data.stats;
  const fmtPct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)} %`);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="eyebrow">Portfolio</div>
          <h1 className="page-title">{t("dashboard.title")}</h1>
        </div>
      </div>

      <section className="stat-grid">
        <div className="stat stat-orange">
          <div className="stat-value">{s.totalEvents}</div>
          <div className="stat-label">{t("dashboard.totalEvents")}</div>
        </div>
        <div className="stat stat-yellow">
          <div className="stat-value">{s.upcomingEventsCount}</div>
          <div className="stat-label">{t("dashboard.upcomingEvents")}</div>
        </div>
        <div className="stat">
          <div className="stat-value">{fmtPct(s.attendanceRate)}</div>
          <div className="stat-label">{t("dashboard.attendanceRate")}</div>
        </div>
        <div className="stat">
          <div className="stat-value">{fmtPct(s.noShowRate)}</div>
          <div className="stat-label">{t("dashboard.noShowRate")}</div>
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">{t("dashboard.eventsByStatus")}</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "var(--space-3)",
            marginTop: "var(--space-4)",
          }}
        >
          {EVENT_STATUSES.map((es) => (
            <MiniCard key={es} label={t(`events.status.${es}`)} value={s.eventsByStatus[es] ?? 0} />
          ))}
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">{t("dashboard.participationByStatus")}</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "var(--space-3)",
            marginTop: "var(--space-4)",
          }}
        >
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

function MiniCard({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-base)",
        padding: "var(--space-3) var(--space-4)",
        background: "var(--bg-subtle)",
      }}
    >
      <div className="stat-label">{label}</div>
      <div
        style={{
          fontSize: "var(--text-xl)",
          fontWeight: "var(--weight-black)",
          color: "var(--fg-default)",
        }}
      >
        {value}
      </div>
    </div>
  );
}
