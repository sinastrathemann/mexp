import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../api/client";
import { AutoGrowTextarea } from "../components/auto-grow-textarea";
import { PlanningFields, planningSummary } from "./planning-fields";
import {
  type AssigneeDto,
  EMPTY_PLANNING,
  type EventPlanMetaDto,
  type PlanningFieldsValue,
} from "./project-plan-types";
import type { EventDto } from "./types";

/**
 * Kopf des Projektplans: Verantwortliche/r + interne EXM-Notiz (Feedback-Runde 3).
 * Ohne gesetzte Person zeigt die Karte, wer das Event angelegt hat (ownerId).
 */
export function PlanMetaCard({ event }: { event: EventDto }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const metaKey = ["events", event.id, "plan-meta"];
  const metaQ = useQuery({
    queryKey: metaKey,
    queryFn: () => apiFetch<{ meta: EventPlanMetaDto }>(`/events/${event.id}/plan-meta`),
  });
  // Gleicher Query-Key wie TaskChecklist → kein zusätzlicher Request.
  const assigneesQ = useQuery({
    queryKey: ["task-assignees"],
    queryFn: () => apiFetch<{ assignees: AssigneeDto[] }>("/task-assignees"),
  });
  const [editing, setEditing] = useState(false);
  const [responsibleId, setResponsibleId] = useState("");
  const [exmNote, setExmNote] = useState("");
  const [planning, setPlanning] = useState<PlanningFieldsValue>(EMPTY_PLANNING);

  const saveMut = useMutation({
    mutationFn: () =>
      apiFetch<{ meta: EventPlanMetaDto }>(`/events/${event.id}/plan-meta`, {
        method: "PUT",
        body: JSON.stringify({
          responsibleId: responsibleId || null,
          exmNote: exmNote || null,
          ...planning,
          targetCount: planning.targetCount?.trim() || null,
        }),
      }),
    onSuccess: (res) => {
      qc.setQueryData(metaKey, res);
      // Event/Projekt wirkt auf Listen, Jahresplanung und Teilnehmersicht
      qc.invalidateQueries({ queryKey: ["year-plan"] });
      qc.invalidateQueries({ queryKey: ["events"] });
      setEditing(false);
    },
  });

  const meta = metaQ.data?.meta;
  const assignees = assigneesQ.data?.assignees ?? [];
  const ownerName = assignees.find((a) => a.id === event.ownerId)?.displayName ?? null;

  function startEdit() {
    setResponsibleId(meta?.responsibleId ?? "");
    setExmNote(meta?.exmNote ?? "");
    setPlanning(meta ? pickPlanning(meta) : EMPTY_PLANNING);
    saveMut.reset();
    setEditing(true);
  }

  if (metaQ.isLoading) {
    return <div className="card muted">{t("projectPlan.loading")}</div>;
  }
  if (metaQ.error instanceof Error) {
    return (
      <div className="card alert alert-error">
        {t("projectPlan.loadError", { message: metaQ.error.message })}
      </div>
    );
  }

  return (
    <div className="card">
      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveMut.mutate();
          }}
        >
          <div className="field">
            <label className="label" htmlFor="pm-responsible">
              {t("projectPlan.metaResponsible")}
            </label>
            <select
              id="pm-responsible"
              className="select"
              value={responsibleId}
              onChange={(e) => setResponsibleId(e.target.value)}
            >
              <option value="">
                {ownerName
                  ? `${ownerName} (${t("projectPlan.metaResponsibleFallback")})`
                  : t("projectPlan.metaResponsibleUnknown")}
              </option>
              {assignees.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.displayName}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="pm-exm-note">
              {t("projectPlan.metaExmNote")}
            </label>
            <AutoGrowTextarea
              id="pm-exm-note"
              className="textarea"
              rows={3}
              maxRows={40}
              maxLength={5000}
              value={exmNote}
              onChange={(e) => setExmNote(e.target.value)}
            />
            <div className="muted" style={{ fontSize: "0.85em" }}>
              {t("projectPlan.metaExmNoteHint")}
            </div>
          </div>
          <PlanningFields idPrefix="pm" value={planning} onChange={setPlanning} />
          {saveMut.error instanceof Error && (
            <div className="alert alert-error">
              {t("projectPlan.metaSaveError", { message: saveMut.error.message })}
            </div>
          )}
          <div className="row" style={{ gap: "var(--space-2)" }}>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saveMut.isPending}>
              {t("projectPlan.metaSave")}
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setEditing(false)}
            >
              {t("projectPlan.metaCancel")}
            </button>
          </div>
        </form>
      ) : (
        <>
          <div
            className="row"
            style={{
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: "var(--space-2)",
            }}
          >
            <div>
              <span className="muted">{t("projectPlan.metaResponsible")}: </span>
              {meta?.responsibleName ? (
                <strong>{meta.responsibleName}</strong>
              ) : ownerName ? (
                <>
                  <strong>{ownerName}</strong>{" "}
                  <span className="muted">({t("projectPlan.metaResponsibleFallback")})</span>
                </>
              ) : (
                <span className="muted">{t("projectPlan.metaResponsibleUnknown")}</span>
              )}
            </div>
            <button type="button" className="btn btn-outline btn-sm" onClick={startEdit}>
              {t("projectPlan.metaEdit")}
            </button>
          </div>
          {meta && (
            <div style={{ marginTop: "var(--space-2)" }}>
              <span className={`badge ${meta.kind === "project" ? "badge-orange" : ""}`}>
                {t(`planning.kind.${meta.kind}`)}
              </span>{" "}
              <span className="muted">{planningSummary(meta, t) ?? t("planning.empty")}</span>
            </div>
          )}
          <div style={{ marginTop: "var(--space-2)" }}>
            <div className="muted">🔒 {t("projectPlan.metaExmNote")}</div>
            {meta?.exmNote ? (
              <div style={{ whiteSpace: "pre-wrap" }}>{meta.exmNote}</div>
            ) : (
              <div className="muted">{t("projectPlan.metaExmNoteEmpty")}</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function pickPlanning(m: EventPlanMetaDto): PlanningFieldsValue {
  return {
    kind: m.kind,
    targetCount: m.targetCount,
    targetCategories: m.targetCategories,
    recurrence: m.recurrence,
    goalReached: m.goalReached,
    alternativeDate: m.alternativeDate,
  };
}
