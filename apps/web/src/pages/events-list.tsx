import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { apiFetch } from "../api/client";
import { useAuth } from "../auth/auth-context";
import { EventStatusBadge } from "../events/status-badge";
import { EVENT_STATUSES, EVENT_TYPES, type EventDto } from "../events/types";

// "2026-11" aus einem ISO-Zeitstempel (lokale Zeit)
function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function EventsListPage() {
  const { t, i18n } = useTranslation();
  const { hasRole } = useAuth();
  const qc = useQueryClient();
  const canCreate = hasRole("admin", "manager", "event_office", "werkstudent");
  const canManage = canCreate;

  const { data, isLoading, error } = useQuery({
    queryKey: ["events", "list"],
    queryFn: () => apiFetch<{ events: EventDto[] }>("/events"),
  });

  // Filter stehen in der URL, damit eine gefilterte Übersicht verlinkt werden kann
  const [params, setParams] = useSearchParams();
  const typeFilter = params.get("type") ?? "";
  const monthFilter = params.get("month") ?? "";
  const statusFilter = params.get("status") ?? "";
  const search = params.get("q") ?? "";
  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };
  const hasFilter = Boolean(typeFilter || monthFilter || statusFilter || search);

  const allEvents = data?.events ?? [];
  const months = useMemo(
    () => Array.from(new Set(allEvents.map((e) => monthKey(e.startAt)))).sort(),
    [allEvents],
  );
  const events = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return allEvents
      .filter((e) => !typeFilter || e.eventType === typeFilter)
      .filter((e) => !monthFilter || monthKey(e.startAt) === monthFilter)
      .filter((e) => !statusFilter || e.status === statusFilter)
      .filter(
        (e) =>
          !needle ||
          e.title.toLowerCase().includes(needle) ||
          (e.location ?? "").toLowerCase().includes(needle),
      )
      .sort((a, b) => a.startAt.localeCompare(b.startAt));
  }, [allEvents, typeFilter, monthFilter, statusFilter, search]);
  const fmtMonth = (key: string) => {
    const [year = "", month = ""] = key.split("-");
    return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString(
      i18n.language === "de" ? "de-DE" : "en-US",
      { month: "long", year: "numeric" },
    );
  };

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const bulkMut = useMutation({
    mutationFn: (status: string) =>
      apiFetch("/events/bulk/status", {
        method: "POST",
        body: JSON.stringify({ eventIds: selectedIds, status }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"] });
      setSelectedIds([]);
    },
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
          <div className="eyebrow">Events · {total.toString().padStart(2, "0")} aktiv</div>
          <h1 className="page-title">{t("events.listTitle")}</h1>
          <p className="page-subtitle">
            Alle Events im Überblick — Coworking, Bereichsevents, Teamevents, Feelgood-Formate und
            mehr.
          </p>
        </div>
        {canCreate && (
          <Link to="/events/new" className="btn btn-primary btn-lg">
            + {t("events.create")}
          </Link>
        )}
      </div>

      {data && allEvents.length > 0 && (
        <div className="card" style={{ padding: "var(--space-3) var(--space-4)" }}>
          <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <input
              type="search"
              className="input"
              placeholder={t("events.filterSearch")}
              value={search}
              onChange={(e) => setFilter("q", e.target.value)}
              style={{ maxWidth: 240 }}
              aria-label={t("events.filterSearch")}
            />
            <select
              className="select"
              value={typeFilter}
              onChange={(e) => setFilter("type", e.target.value)}
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
              value={monthFilter}
              onChange={(e) => setFilter("month", e.target.value)}
              style={{ maxWidth: 200 }}
              aria-label={t("events.filterMonth")}
            >
              <option value="">{t("events.filterAllMonths")}</option>
              {months.map((m) => (
                <option key={m} value={m}>
                  {fmtMonth(m)}
                </option>
              ))}
            </select>
            {canManage && (
              <select
                className="select"
                value={statusFilter}
                onChange={(e) => setFilter("status", e.target.value)}
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
            {hasFilter && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setParams(new URLSearchParams(), { replace: true })}
              >
                {t("events.filterReset")}
              </button>
            )}
            <span className="muted text-sm" style={{ marginLeft: "auto" }}>
              {t("events.filterCount", { count: events.length, total: allEvents.length })}
            </span>
          </div>
        </div>
      )}

      {isLoading && <div className="card">{t("auth.loading")}</div>}
      {error instanceof Error && <div className="alert alert-error">{error.message}</div>}

      {canManage && events.length > 0 && (
        <label
          className="row"
          style={{ gap: 6, marginBottom: 12, fontSize: 14, color: "var(--fg-muted)" }}
        >
          <input
            type="checkbox"
            checked={selectedIds.length === events.length}
            onChange={(e) => {
              if (e.target.checked) setSelectedIds(events.map((ev) => ev.id));
              else setSelectedIds([]);
            }}
          />
          Alle auswählen
        </label>
      )}

      {canManage && selectedIds.length > 0 && (
        <div
          className="card"
          style={{ padding: 12, marginBottom: 16, background: "var(--color-orange-50)" }}
        >
          <strong>{selectedIds.length} Events ausgewählt</strong>
          <select
            disabled={bulkMut.isPending}
            onChange={(e) => {
              if (e.target.value) {
                bulkMut.mutate(e.target.value);
                e.target.value = "";
              }
            }}
            style={{ marginLeft: 12 }}
          >
            <option value="">Status ändern…</option>
            {EVENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                → {t(`events.status.${s}`)}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ marginLeft: 8 }}
            onClick={() => setSelectedIds([])}
          >
            Auswahl aufheben
          </button>
          {bulkMut.error instanceof Error && (
            <div className="alert alert-error" style={{ marginTop: 8 }}>
              {bulkMut.error.message}
            </div>
          )}
        </div>
      )}

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

      {data && allEvents.length > 0 && events.length === 0 && (
        <div className="card muted">{t("events.filterEmpty")}</div>
      )}

      {events.length > 0 && (
        <div className="event-grid">
          {events.map((e) => (
            <Link key={e.id} to={`/events/${e.id}`} className="event-card" data-status={e.status}>
              {canManage && (
                <input
                  type="checkbox"
                  checked={selectedIds.includes(e.id)}
                  onChange={(ev) => {
                    if (ev.target.checked) setSelectedIds([...selectedIds, e.id]);
                    else setSelectedIds(selectedIds.filter((id) => id !== e.id));
                  }}
                  onClick={(ev) => ev.stopPropagation()}
                  style={{ position: "absolute", top: 12, right: 12, transform: "scale(1.3)" }}
                />
              )}
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
                {canManage && e.registeredCount !== undefined ? (
                  <div className="event-card-meta-row">
                    <span className="event-card-meta-label">{t("events.registrations")}</span>
                    <span className="event-card-meta-value text-mono">
                      {e.registeredCount}
                      {e.capacity !== null && e.capacity !== undefined && ` / ${e.capacity}`}
                      {(e.waitlistCount ?? 0) > 0 &&
                        ` · ${t("participants.waitlistCount", { count: e.waitlistCount ?? 0 })}`}
                    </span>
                  </div>
                ) : (
                  e.capacity !== null &&
                  e.capacity !== undefined && (
                    <div className="event-card-meta-row">
                      <span className="event-card-meta-label">Plätze</span>
                      <span className="event-card-meta-value text-mono">{e.capacity}</span>
                    </div>
                  )
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
