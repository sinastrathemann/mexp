import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../api/client";

interface ReportSummary {
  totalEvents: number;
  eventsByType: Record<string, number>;
  eventsByStatus: Record<string, number>;
  totalParticipations: number;
  totalCheckedIn: number;
  totalWaitlisted: number;
  avgParticipantsPerEvent: number;
  topEventTypes: Array<{ type: string; count: number }>;
  eventsByDepartment: Record<string, number>;
  eventsByTeam: Record<string, number>;
}

const TYPE_LABELS: Record<string, string> = {
  mindsquare: "mindsquare Event",
  office: "Büroevent",
  feelgood: "Feelgood Event",
  team: "Teamevent",
  strategy: "Strategieevent",
  division: "Bereichsevent",
  local_experience: "Local Experience",
};

const TYPE_FILL: Record<string, string> = {
  mindsquare: "fill-cobalt",
  office: "fill-yellow",
  feelgood: "fill-lime",
  team: "fill-orange",
  strategy: "fill-cobalt",
  division: "fill-orange",
  local_experience: "fill-yellow",
};

export default function ReportsPage() {
  const reportQ = useQuery({
    queryKey: ["reports", "summary"],
    queryFn: () => apiFetch<ReportSummary>("/reports/summary"),
  });

  const data = reportQ.data;

  const downloadCsv = (which: "events" | "participants") => {
    window.open(`/api/reports/${which}.csv`, "_blank");
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="eyebrow">Reports · Geschäftsführung</div>
          <h1 className="page-title">📊 Reports</h1>
          <p className="page-subtitle">Portfolio, Teilnehmerentwicklung, KPIs</p>
        </div>
        <div className="row" style={{ gap: 8, alignItems: "flex-end" }}>
          <button type="button" className="btn btn-outline" onClick={() => downloadCsv("events")}>
            ⬇ Events (CSV)
          </button>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => downloadCsv("participants")}
          >
            ⬇ Teilnahmen (CSV)
          </button>
        </div>
      </div>

      {reportQ.isLoading && <div className="muted">Lädt…</div>}
      {reportQ.error instanceof Error && (
        <div className="alert alert-error">{reportQ.error.message}</div>
      )}

      {data && data.totalEvents === 0 && (
        <div className="card" style={{ textAlign: "center", padding: "var(--space-10)" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "var(--space-3)" }}>🗒️</div>
          <h3 style={{ margin: 0 }}>Noch keine Events erfasst</h3>
          <p className="muted" style={{ marginTop: "var(--space-2)" }}>
            Sobald Events angelegt und Teilnehmer registriert sind, erscheinen hier Kennzahlen und
            Charts.
          </p>
        </div>
      )}

      {data && data.totalEvents > 0 && (
        <>
          {/* ─── KPI-Kacheln ─────────────────────────────────── */}
          <section className="bento" style={{ marginBottom: "var(--space-10)" }}>
            <div className="bento-tile tone-ink span-3">
              <div className="bento-decorative" />
              <div className="bento-eyebrow">📅 Gesamt-Events</div>
              <div className="bento-headline">{data.totalEvents}</div>
              <div className="bento-sub">
                Ø {data.avgParticipantsPerEvent.toFixed(1)} Teilnahmen / Event
              </div>
            </div>
            <div className="bento-tile tone-orange span-3">
              <div className="bento-eyebrow">👥 Registrierte Teilnahmen</div>
              <div className="bento-headline">{data.totalParticipations}</div>
              <div className="bento-sub">über alle Events</div>
            </div>
            <div className="bento-tile tone-yellow span-3">
              <div className="bento-eyebrow">✓ Teilnahmen abgeschlossen</div>
              <div className="bento-headline">{data.totalCheckedIn}</div>
              <div className="bento-sub">eingecheckt</div>
            </div>
            <div className="bento-tile span-3">
              <div className="bento-eyebrow">⏳ Wartelisten-Einträge</div>
              <div className="bento-headline">{data.totalWaitlisted}</div>
              <div className="bento-sub muted">wartend auf Nachrücken</div>
            </div>
          </section>

          {/* ─── Events nach Typ ─────────────────────────────── */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="eyebrow">Format-Mix</div>
                <h3 className="card-title">Events nach Typ</h3>
              </div>
              <span className="badge badge-outline">
                {Object.keys(data.eventsByType).length} Typen
              </span>
            </div>
            <BarList entries={data.eventsByType} labels={TYPE_LABELS} fills={TYPE_FILL} />
          </div>

          {/* ─── Events nach Bereich ─────────────────────────── */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="eyebrow">Departments</div>
                <h3 className="card-title">Events nach Bereich</h3>
              </div>
              <span className="badge badge-outline">
                {Object.keys(data.eventsByDepartment).length} Bereiche
              </span>
            </div>
            <BarList
              entries={data.eventsByDepartment}
              fill="fill-cobalt"
              twoCol={Object.keys(data.eventsByDepartment).length > 6}
            />
          </div>

          {/* ─── Events nach Team ────────────────────────────── */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="eyebrow">Teams</div>
                <h3 className="card-title">Events nach Team</h3>
              </div>
              <span className="badge badge-outline">
                {Object.keys(data.eventsByTeam).length} Teams
              </span>
            </div>
            <BarList
              entries={data.eventsByTeam}
              fill="fill-lime"
              twoCol={Object.keys(data.eventsByTeam).length > 6}
            />
          </div>

          {/* ─── Top-Event-Typen ─────────────────────────────── */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="eyebrow">Top 5</div>
                <h3 className="card-title">Top-Event-Typen</h3>
              </div>
            </div>
            {data.topEventTypes.length === 0 ? (
              <p className="muted">Keine Daten.</p>
            ) : (
              <ol style={{ margin: 0, paddingLeft: 18 }}>
                {data.topEventTypes.map((t) => (
                  <li key={t.type} style={{ marginBottom: 8 }}>
                    <span className="text-bold">{TYPE_LABELS[t.type] ?? t.type}</span>{" "}
                    <span className="muted text-sm">
                      · {t.count} Event{t.count === 1 ? "" : "s"}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* ─── CSV-Export ──────────────────────────────────── */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="eyebrow">Export</div>
                <h3 className="card-title">CSV-Exporte</h3>
              </div>
            </div>
            <p className="muted text-sm" style={{ marginTop: 0 }}>
              Semikolon-getrennt, UTF-8 mit BOM — öffnet direkt korrekt in Excel (DE).
            </p>
            <div className="row" style={{ gap: 8, marginTop: "var(--space-4)" }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => downloadCsv("events")}
              >
                ⬇ events.csv — alle Events
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => downloadCsv("participants")}
              >
                ⬇ participants.csv — alle Teilnahmen
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function BarList({
  entries,
  labels,
  fills,
  fill,
  twoCol,
}: {
  entries: Record<string, number>;
  labels?: Record<string, string>;
  fills?: Record<string, string>;
  fill?: string;
  twoCol?: boolean;
}) {
  const list = Object.entries(entries).sort((a, b) => b[1] - a[1]);
  if (list.length === 0) {
    return <p className="muted">Keine Daten.</p>;
  }
  const max = Math.max(1, ...list.map(([, count]) => count));
  return (
    <div className={`bento-bars${twoCol ? " bar-grid-2col" : ""}`}>
      {list.map(([key, count]) => {
        const pct = (count / max) * 100;
        return (
          <div key={key} className="bar-row">
            <span className="bar-label">{labels?.[key] ?? key}</span>
            <span className="bar-track">
              <span
                className={`bar-fill ${fills?.[key] ?? fill ?? "fill-orange"}`}
                style={{ width: `${Math.max(pct, 2)}%` }}
              />
            </span>
            <span className="bar-value">{count}</span>
          </div>
        );
      })}
    </div>
  );
}
