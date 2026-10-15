import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { EVENT_STATUSES, EVENT_TYPES, type EventDto } from "./types";

// Filter für Event-Übersichten (Startseite + Events-Liste): Kategorie, Monat,
// optional Status, Freitext. Die Werte stehen in der URL, damit eine gefilterte
// Übersicht verlinkt werden kann und der Filter beim Zurück-Navigieren erhalten bleibt.

// "2026-11" aus einem ISO-Zeitstempel (lokale Zeit)
function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export interface EventFilters {
  filtered: EventDto[];
  months: string[];
  type: string;
  month: string;
  status: string;
  search: string;
  hasFilter: boolean;
  setFilter: (key: "type" | "month" | "status" | "q", value: string) => void;
  reset: () => void;
}

export function useEventFilters(events: EventDto[]): EventFilters {
  const [params, setParams] = useSearchParams();
  const type = params.get("type") ?? "";
  const month = params.get("month") ?? "";
  const status = params.get("status") ?? "";
  const search = params.get("q") ?? "";

  const months = useMemo(
    () => Array.from(new Set(events.map((e) => monthKey(e.startAt)))).sort(),
    [events],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return events
      .filter((e) => !type || e.eventType === type)
      .filter((e) => !month || monthKey(e.startAt) === month)
      .filter((e) => !status || e.status === status)
      .filter(
        (e) =>
          !needle ||
          e.title.toLowerCase().includes(needle) ||
          (e.location ?? "").toLowerCase().includes(needle),
      )
      .sort((a, b) => a.startAt.localeCompare(b.startAt));
  }, [events, type, month, status, search]);

  return {
    filtered,
    months,
    type,
    month,
    status,
    search,
    hasFilter: Boolean(type || month || status || search),
    setFilter: (key, value) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (value) next.set(key, value);
          else next.delete(key);
          return next;
        },
        { replace: true },
      );
    },
    reset: () => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const key of ["type", "month", "status", "q"]) next.delete(key);
          return next;
        },
        { replace: true },
      );
    },
  };
}

export function EventFilterBar({
  filters,
  total,
  showStatus = false,
}: {
  filters: EventFilters;
  total: number;
  showStatus?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const fmtMonth = (key: string) => {
    const [year = "", m = ""] = key.split("-");
    return new Date(Number(year), Number(m) - 1, 1).toLocaleDateString(
      i18n.language === "de" ? "de-DE" : "en-US",
      { month: "long", year: "numeric" },
    );
  };

  return (
    <div className="card" style={{ padding: "var(--space-3) var(--space-4)" }}>
      <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="search"
          className="input"
          placeholder={t("events.filterSearch")}
          value={filters.search}
          onChange={(e) => filters.setFilter("q", e.target.value)}
          style={{ maxWidth: 240 }}
          aria-label={t("events.filterSearch")}
        />
        <select
          className="select"
          value={filters.type}
          onChange={(e) => filters.setFilter("type", e.target.value)}
          style={{ maxWidth: 220 }}
          aria-label={t("events.filterType")}
        >
          <option value="">{t("events.filterAllTypes")}</option>
          {EVENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`events.type.${type}`)}
            </option>
          ))}
        </select>
        <select
          className="select"
          value={filters.month}
          onChange={(e) => filters.setFilter("month", e.target.value)}
          style={{ maxWidth: 200 }}
          aria-label={t("events.filterMonth")}
        >
          <option value="">{t("events.filterAllMonths")}</option>
          {filters.months.map((m) => (
            <option key={m} value={m}>
              {fmtMonth(m)}
            </option>
          ))}
        </select>
        {showStatus && (
          <select
            className="select"
            value={filters.status}
            onChange={(e) => filters.setFilter("status", e.target.value)}
            style={{ maxWidth: 200 }}
            aria-label={t("events.filterStatus")}
          >
            <option value="">{t("events.filterAllStatuses")}</option>
            {EVENT_STATUSES.map((st) => (
              <option key={st} value={st}>
                {t(`events.status.${st}`)}
              </option>
            ))}
          </select>
        )}
        {filters.hasFilter && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={filters.reset}>
            {t("events.filterReset")}
          </button>
        )}
        <span className="muted text-sm" style={{ marginLeft: "auto" }}>
          {t("events.filterCount", { count: filters.filtered.length, total })}
        </span>
      </div>
    </div>
  );
}
