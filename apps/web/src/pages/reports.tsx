import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { apiFetch } from "../api/client";

interface MonthBucket {
  totalEvents: number;
  byType: Record<string, number>;
  byLocation: Record<string, number>;
  participantsRegistered: number;
  participantsAttended: number;
  participantsNoShow: number;
  totalCapacity: number;
  avgUtilization: number | null;
  attendanceRate: number | null;
  noShowRate: number | null;
  biggestEvent: { id: string; title: string; count: number } | null;
  topLocations: { location: string; count: number }[];
  totalPlannedCents: number;
  totalNetCents: number;
  byTypeNetCents: Record<string, number>;
  byTypePlannedCents: Record<string, number>;
  costPerPersonCents: number | null;
  topEventsByCost: { id: string; title: string; eventType: string; netCents: number }[];
}

interface MonthlyReport {
  period: { year: number; month: number; label: string };
  previousPeriod: { year: number; month: number; label: string };
  current: MonthBucket;
  previous: MonthBucket;
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

export default function ReportsPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  const reportQ = useQuery({
    queryKey: ["reports", "monthly", year, month],
    queryFn: () =>
      apiFetch<MonthlyReport>(`/reports/monthly?year=${year}&month=${month}`),
  });

  const data = reportQ.data;

  const handleCsv = () => {
    window.open(`/api/reports/monthly.csv?year=${year}&month=${month}`, "_blank");
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="eyebrow">Reports · Geschäftsführung</div>
          <h1 className="page-title">Monats-Reporting</h1>
          <p className="page-subtitle">
            Kennzahlen pro Monat — Events, Teilnehmer, Auslastung. Vergleich zum Vormonat.
          </p>
        </div>
        <div className="row" style={{ gap: 8, alignItems: "flex-end" }}>
          <div className="field" style={{ margin: 0 }}>
            <label className="label" htmlFor="rep-month">
              Monat
            </label>
            <input
              id="rep-month"
              className="input"
              type="month"
              value={`${year}-${String(month).padStart(2, "0")}`}
              onChange={(e) => {
                const [y, m] = e.target.value.split("-");
                if (y && m) {
                  setYear(Number.parseInt(y, 10));
                  setMonth(Number.parseInt(m, 10));
                }
              }}
            />
          </div>
          <button type="button" className="btn btn-outline" onClick={handleCsv}>
            ⬇ CSV-Export
          </button>
        </div>
      </div>

      {reportQ.isLoading && <div className="muted">Lädt…</div>}
      {reportQ.error instanceof Error && (
        <div className="alert alert-error">{reportQ.error.message}</div>
      )}

      {data && (
        <>
          <div className="eyebrow" style={{ marginBottom: "var(--space-4)" }}>
            {data.period.label} <span style={{ color: "var(--fg-subtle)" }}> · vs. </span>
            {data.previousPeriod.label}
          </div>

          {/* KPI-Bento */}
          <section className="bento">
            <Kpi
              tone="ink"
              span={5}
              row={2}
              label="Events gesamt"
              value={data.current.totalEvents}
              previous={data.previous.totalEvents}
              size="hero"
            />
            <Kpi
              tone="orange"
              span={4}
              label="Anmeldungen"
              value={data.current.participantsRegistered}
              previous={data.previous.participantsRegistered}
            />
            <Kpi
              tone="yellow"
              span={3}
              label="Anwesend"
              value={data.current.participantsAttended}
              previous={data.previous.participantsAttended}
            />
            <Kpi
              span={4}
              label="Auslastung"
              value={pct(data.current.avgUtilization)}
              previous={pct(data.previous.avgUtilization)}
              numeric={false}
            />
            <Kpi
              span={3}
              label="Teilnahme-Quote"
              value={pct(data.current.attendanceRate)}
              previous={pct(data.previous.attendanceRate)}
              numeric={false}
            />

            {/* Eventtyp-Verteilung */}
            <div className="bento-tile span-7">
              <div className="bento-eyebrow">Eventtypen im Monat</div>
              <h3 style={{ marginTop: "var(--space-2)", marginBottom: "var(--space-4)" }}>
                Format-Mix
              </h3>
              {Object.keys(data.current.byType).length === 0 ? (
                <p className="muted">Keine Events in diesem Monat.</p>
              ) : (
                <TypeBars byType={data.current.byType} />
              )}
            </div>

            {/* Top Locations */}
            <div className="bento-tile span-5">
              <div className="bento-eyebrow">Top-Locations</div>
              <h3 style={{ marginTop: "var(--space-2)", marginBottom: "var(--space-4)" }}>
                Wo gefeiert wurde
              </h3>
              {data.current.topLocations.length === 0 ? (
                <p className="muted">Keine Locations.</p>
              ) : (
                <ol style={{ margin: 0, paddingLeft: 18 }}>
                  {data.current.topLocations.map((l) => (
                    <li key={l.location} style={{ marginBottom: 6 }}>
                      <span className="text-bold">{l.location}</span>{" "}
                      <span className="muted text-sm">· {l.count}×</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            {/* Biggest event */}
            {data.current.biggestEvent && (
              <div className="bento-tile tone-paper span-12">
                <div className="bento-eyebrow">Größtes Event</div>
                <h3 style={{ marginTop: "var(--space-2)" }}>
                  {data.current.biggestEvent.title}
                </h3>
                <p className="muted text-sm" style={{ margin: 0 }}>
                  {data.current.biggestEvent.count} Teilnehmer (registriert + anwesend)
                </p>
              </div>
            )}
          </section>

          {/* ─── Budget-Sektion ─────────────────────────────── */}
          <div className="eyebrow" style={{ marginTop: "var(--space-10)", marginBottom: "var(--space-4)" }}>
            Budget · Ausgaben
          </div>
          <section className="bento">
            <Kpi
              tone="orange"
              span={4}
              label="Σ Netto-Ist"
              value={fmtMoney(data.current.totalNetCents)}
              previous={fmtMoney(data.previous.totalNetCents)}
              numeric={false}
            />
            <Kpi
              tone="ink"
              span={4}
              label="Σ Geplant"
              value={fmtMoney(data.current.totalPlannedCents)}
              previous={fmtMoney(data.previous.totalPlannedCents)}
              numeric={false}
            />
            <Kpi
              tone="yellow"
              span={4}
              label="Netto / Person"
              value={
                data.current.costPerPersonCents !== null
                  ? fmtMoney(data.current.costPerPersonCents)
                  : "—"
              }
              previous={
                data.previous.costPerPersonCents !== null
                  ? fmtMoney(data.previous.costPerPersonCents)
                  : "—"
              }
              numeric={false}
            />

            {/* Ausgaben pro Eventtyp */}
            <div className="bento-tile span-7">
              <div className="bento-eyebrow">Netto-Ausgaben nach Eventtyp</div>
              <h3 style={{ marginTop: "var(--space-2)", marginBottom: "var(--space-4)" }}>
                Wo geht das Geld hin
              </h3>
              {Object.keys(data.current.byTypeNetCents).length === 0 ||
              Object.values(data.current.byTypeNetCents).every((v) => v === 0) ? (
                <p className="muted">Noch keine Rechnungen erfasst.</p>
              ) : (
                <CostBars byTypeNetCents={data.current.byTypeNetCents} />
              )}
            </div>

            {/* Top Events nach Kosten */}
            <div className="bento-tile span-5">
              <div className="bento-eyebrow">Teuerste Events</div>
              <h3 style={{ marginTop: "var(--space-2)", marginBottom: "var(--space-4)" }}>
                Top 5 nach Netto
              </h3>
              {data.current.topEventsByCost.length === 0 ? (
                <p className="muted">Keine Daten.</p>
              ) : (
                <ol style={{ margin: 0, paddingLeft: 18 }}>
                  {data.current.topEventsByCost.map((e) => (
                    <li key={e.id} style={{ marginBottom: 8 }}>
                      <div className="text-bold">{e.title}</div>
                      <div className="muted text-xs">
                        {TYPE_LABELS[e.eventType] ?? e.eventType} ·{" "}
                        <span className="text-mono">{fmtMoney(e.netCents)}</span>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function pct(v: number | null): string {
  return v === null ? "—" : `${Math.round(v * 100)}%`;
}

function fmtMoney(cents: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function CostBars({ byTypeNetCents }: { byTypeNetCents: Record<string, number> }) {
  const entries = Object.entries(byTypeNetCents)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  return (
    <div className="bento-bars">
      {entries.map(([type, cents]) => {
        const pctVal = (cents / max) * 100;
        return (
          <div key={type} className="bar-row">
            <span className="bar-label">{TYPE_LABELS[type] ?? type}</span>
            <span className="bar-track">
              <span
                className="bar-fill fill-orange"
                style={{ width: `${Math.max(pctVal, 2)}%` }}
              />
            </span>
            <span className="bar-value">{fmtMoney(cents)}</span>
          </div>
        );
      })}
    </div>
  );
}

function Kpi({
  label,
  value,
  previous,
  tone,
  span = 3,
  row,
  size,
  numeric = true,
}: {
  label: string;
  value: number | string;
  previous: number | string;
  tone?: "ink" | "orange" | "yellow";
  span?: 3 | 4 | 5 | 6 | 7 | 8 | 12;
  row?: 2;
  size?: "hero";
  numeric?: boolean;
}) {
  const toneClass = tone ? `tone-${tone}` : "";
  const rowClass = row === 2 ? "row-2" : "";
  const delta =
    numeric && typeof value === "number" && typeof previous === "number"
      ? value - previous
      : null;
  return (
    <div className={`bento-tile ${toneClass} span-${span} ${rowClass}`}>
      {tone === "ink" && <div className="bento-decorative" />}
      <div className="bento-eyebrow">{label}</div>
      <div
        className={`bento-headline ${size === "hero" ? "" : "size-md"}`}
        style={size === "hero" ? { fontSize: "clamp(4rem, 9vw, 7rem)" } : {}}
      >
        {value}
      </div>
      <div className="bento-sub" style={{ marginTop: "var(--space-3)" }}>
        Vormonat: <span className="text-mono">{previous}</span>
        {delta !== null && delta !== 0 && (
          <span
            style={{
              marginLeft: 8,
              fontFamily: "var(--font-mono)",
              fontWeight: 700,
              color:
                tone === "ink" || tone === "orange"
                  ? "var(--color-white)"
                  : delta > 0
                    ? "var(--brand-lime)"
                    : "var(--brand-orange)",
            }}
          >
            {delta > 0 ? "↑" : "↓"} {Math.abs(delta)}
          </span>
        )}
      </div>
    </div>
  );
}

function TypeBars({ byType }: { byType: Record<string, number> }) {
  const max = Math.max(1, ...Object.values(byType));
  const entries = Object.entries(byType).sort((a, b) => b[1] - a[1]);
  return (
    <div className="bento-bars">
      {entries.map(([type, count]) => {
        const pct = (count / max) * 100;
        return (
          <div key={type} className="bar-row">
            <span className="bar-label">{TYPE_LABELS[type] ?? type}</span>
            <span className="bar-track">
              <span
                className="bar-fill fill-orange"
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
