import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { apiFetch } from "../api/client";
import { fmtIsoDate } from "../events/planning-utils";
import type { YearPlanDto, YearPlanInternalDto } from "../events/project-plan-types";

type RowKind = "internal" | "external" | "holiday" | "school_holiday";
interface Row {
  key: string;
  kind: RowKind;
  date: string;
  endDate: string | null;
  title: string;
  manualId?: string;
  internal?: YearPlanInternalDto;
  isOption?: boolean;
}

/** Baut die sortierten Zeilen der Jahresplanung; Events mit Alternativtermin erscheinen zweimal. */
export function buildYearRows(data: YearPlanDto): Row[] {
  const rows: Row[] = [];
  for (const h of data.holidays) {
    rows.push({ key: `h-${h.date}`, kind: "holiday", date: h.date, endDate: null, title: h.title });
  }
  for (const m of data.manual) {
    rows.push({
      key: `m-${m.id}`,
      kind: m.kind,
      date: m.date,
      endDate: m.endDate,
      title: m.title,
      manualId: m.id,
    });
  }
  const year = String(data.year);
  for (const e of data.internal) {
    const hasOption = e.alternativeDate !== null;
    const end = e.endDate ?? e.date;
    if (e.date && end && e.date <= `${year}-12-31` && end >= `${year}-01-01`) {
      rows.push({
        key: `i-${e.id}`,
        kind: "internal",
        date: e.date,
        endDate: e.endDate !== e.date ? e.endDate : null,
        title: e.title,
        internal: e,
        isOption: hasOption,
      });
    }
    if (e.alternativeDate?.startsWith(year)) {
      rows.push({
        key: `i-${e.id}-alt`,
        kind: "internal",
        date: e.alternativeDate,
        endDate: null,
        title: e.title,
        internal: e,
        isOption: true,
      });
    }
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind));
}

/** Jahresplanung des EXM-Teams (Feedback-Runde 5) — ersetzt den OneNote-„Projektplan". */
export default function YearPlanPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [year, setYear] = useState(() => new Date().getFullYear() + 1);
  const [show, setShow] = useState({ internal: true, external: true, holidays: true });
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({
    kind: "external" as "external" | "school_holiday",
    title: "",
    date: "",
    endDate: "",
  });

  const planQ = useQuery({
    queryKey: ["year-plan", year],
    queryFn: () => apiFetch<YearPlanDto>(`/year-plan?year=${year}`),
  });
  const addMut = useMutation({
    mutationFn: () =>
      apiFetch("/year-plan/entries", {
        method: "POST",
        body: JSON.stringify({
          kind: draft.kind,
          title: draft.title.trim(),
          date: draft.date,
          endDate: draft.endDate || null,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["year-plan"] });
      setDraft({ kind: "external", title: "", date: "", endDate: "" });
      setAdding(false);
    },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/year-plan/entries/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["year-plan"] }),
  });

  const rows = planQ.data ? buildYearRows(planQ.data) : [];
  const visible = rows.filter((r) =>
    r.kind === "internal" ? show.internal : r.kind === "external" ? show.external : show.holidays,
  );

  return (
    <div className="page">
      <div className="eyebrow">mEXP · {t("planning.teamOnly")}</div>
      <h1>{t("planning.yearPlanTitle")}</h1>

      <div
        className="row"
        style={{ gap: "var(--space-2)", flexWrap: "wrap", alignItems: "center" }}
      >
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setYear(year - 1)}>
          ‹
        </button>
        <strong>{year}</strong>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setYear(year + 1)}>
          ›
        </button>
        <span style={{ flex: 1 }} />
        {(["internal", "external", "holidays"] as const).map((k) => (
          <button
            key={k}
            type="button"
            className={`btn btn-sm ${show[k] ? "btn-primary" : "btn-outline"}`}
            aria-pressed={show[k]}
            onClick={() => setShow({ ...show, [k]: !show[k] })}
          >
            {t(`planning.filter.${k}`)}
          </button>
        ))}
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setAdding(!adding)}>
          + {t("planning.addExternal")}
        </button>
      </div>

      {adding && (
        <form
          className="card"
          onSubmit={(e) => {
            e.preventDefault();
            addMut.mutate();
          }}
        >
          <div className="field-row">
            <div className="field">
              <label className="label" htmlFor="yp-kind">
                {t("planning.entryKind")}
              </label>
              <select
                id="yp-kind"
                className="select"
                value={draft.kind}
                onChange={(e) =>
                  setDraft({ ...draft, kind: e.target.value as "external" | "school_holiday" })
                }
              >
                <option value="external">{t("planning.rowKind.external")}</option>
                <option value="school_holiday">{t("planning.rowKind.school_holiday")}</option>
              </select>
            </div>
            <div className="field" style={{ flex: 3 }}>
              <label className="label" htmlFor="yp-title">
                {t("planning.titleLabel")}
              </label>
              <input
                id="yp-title"
                className="input"
                required
                maxLength={300}
                placeholder={t("planning.externalPlaceholder")}
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label className="label" htmlFor="yp-date">
                {t("planning.from")}
              </label>
              <input
                id="yp-date"
                type="date"
                className="input"
                required
                value={draft.date}
                onChange={(e) => setDraft({ ...draft, date: e.target.value })}
              />
            </div>
            <div className="field">
              <label className="label" htmlFor="yp-end">
                {t("planning.toOptional")}
              </label>
              <input
                id="yp-end"
                type="date"
                className="input"
                min={draft.date || undefined}
                value={draft.endDate}
                onChange={(e) => setDraft({ ...draft, endDate: e.target.value })}
              />
            </div>
          </div>
          {addMut.error instanceof Error && (
            <div className="alert alert-error">{addMut.error.message}</div>
          )}
          <div className="row" style={{ gap: "var(--space-2)" }}>
            <button type="submit" className="btn btn-primary btn-sm" disabled={addMut.isPending}>
              {t("planning.save")}
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setAdding(false)}
            >
              {t("planning.cancel")}
            </button>
          </div>
        </form>
      )}

      {planQ.error instanceof Error && (
        <div className="alert alert-error">{planQ.error.message}</div>
      )}

      <div className="card" style={{ overflowX: "auto" }}>
        {planQ.isLoading ? (
          <p className="muted">{t("projectPlan.loading")}</p>
        ) : visible.length === 0 ? (
          <p className="muted">{t("planning.noEntries")}</p>
        ) : (
          <table className="table year-plan-table">
            <thead>
              <tr>
                <th>{t("planning.date")}</th>
                <th>{t("planning.entry")}</th>
                <th>{t("planning.responsible")}</th>
                <th>{t("planning.targetCount")}</th>
                <th>{t("planning.goalReached")}</th>
                <th>{t("planning.recurrence")}</th>
                <th aria-label={t("planning.delete")} />
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const e = r.internal;
                const target = e
                  ? [
                      e.targetCategories.length > 0
                        ? `${t("planning.categoriesShort")} ${e.targetCategories.join(",")}`
                        : null,
                      e.targetCount,
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : "";
                return (
                  <tr key={r.key} className={`year-row year-row-${r.kind}`}>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {fmtIsoDate(r.date, false)}
                      {r.endDate ? `–${fmtIsoDate(r.endDate, false)}` : ""}
                    </td>
                    <td>
                      {r.kind === "internal" && e ? (
                        <>
                          <strong>I |</strong> <Link to={`/events/${e.id}`}>{r.title}</Link>
                          {e.kind === "project" && (
                            <span className="badge badge-orange" style={{ marginLeft: 6 }}>
                              {t("planning.kind.project")}
                            </span>
                          )}
                          {r.isOption && (
                            <span className="badge" style={{ marginLeft: 6 }}>
                              {t("planning.option")}
                            </span>
                          )}
                          {e.archived && <span className="muted"> · {t("planning.archived")}</span>}
                        </>
                      ) : r.kind === "external" ? (
                        <span className="muted">E | {r.title}</span>
                      ) : (
                        <span>
                          {t(`planning.rowKind.${r.kind}`)}: {r.title}
                        </span>
                      )}
                    </td>
                    <td>{e ? (e.responsibleName ?? "–") : ""}</td>
                    <td>{target}</td>
                    <td>{e?.goalReached ? t(`planning.goal.${e.goalReached}`) : ""}</td>
                    <td>{e?.recurrence ?? ""}</td>
                    <td>
                      {r.manualId && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          aria-label={t("planning.delete")}
                          disabled={deleteMut.isPending}
                          onClick={() => {
                            if (window.confirm(t("planning.confirmDelete"))) {
                              deleteMut.mutate(r.manualId as string);
                            }
                          }}
                        >
                          ×
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
