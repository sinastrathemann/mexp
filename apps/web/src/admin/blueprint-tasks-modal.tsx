import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../api/client";
import type { BlueprintTaskDto } from "../events/project-plan-types";

interface Row {
  // Nur für React: stabiler Schlüssel (bei Serverdaten = id), wird nicht gespeichert.
  key: string;
  id?: string | undefined;
  title: string;
  daysBefore: string;
  linkLabel: string;
  linkUrl: string;
}

function toRow(t: BlueprintTaskDto): Row {
  return {
    key: t.id ?? crypto.randomUUID(),
    id: t.id,
    title: t.title,
    daysBefore: t.daysBefore === null ? "" : String(t.daysBefore),
    linkLabel: t.linkLabel ?? "",
    linkUrl: t.linkUrl ?? "",
  };
}

// Link nur komplett oder gar nicht: Text und URL werden nur gemeinsam gespeichert.
function toDto(r: Row): BlueprintTaskDto {
  const hasLink = r.linkLabel.trim() !== "" || r.linkUrl.trim() !== "";
  return {
    // exactOptionalPropertyTypes: id nur setzen, wenn vorhanden (neue Zeilen haben keine id).
    ...(r.id === undefined ? {} : { id: r.id }),
    title: r.title.trim(),
    daysBefore: r.daysBefore === "" ? null : Number(r.daysBefore),
    linkLabel: hasLink ? r.linkLabel.trim() : null,
    linkUrl: hasLink ? r.linkUrl.trim() : null,
  };
}

interface Props {
  blueprintId: string;
  name: string;
  onClose: () => void;
}

export function BlueprintTasksModal({ blueprintId, name, onClose }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const key = ["blueprints", blueprintId, "tasks"];
  const q = useQuery({
    queryKey: key,
    queryFn: () => apiFetch<{ tasks: BlueprintTaskDto[] }>(`/blueprints/${blueprintId}/tasks`),
    refetchOnWindowFocus: false, // Editor: ungespeicherte Eingaben nicht überschreiben
  });
  // null = noch nicht aus den Serverdaten übernommen
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    if (rows === null && q.data) setRows(q.data.tasks.map(toRow));
  }, [rows, q.data]);

  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const saveMut = useMutation({
    mutationFn: () =>
      apiFetch<{ tasks: BlueprintTaskDto[] }>(`/blueprints/${blueprintId}/tasks`, {
        method: "PUT",
        body: JSON.stringify({ tasks: (rows ?? []).map(toDto) }),
      }),
    onSuccess: (data) => {
      qc.setQueryData(key, data);
      onClose();
    },
  });

  const update = (i: number, patch: Partial<Row>) =>
    setRows((r) => r?.map((row, idx) => (idx === i ? { ...row, ...patch } : row)) ?? null);

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <form
        className="modal"
        // biome-ignore lint/a11y/useSemanticElements: <dialog> brächte UA-Styles/Positionierung, das bestehende .modal-Layout bleibt
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        style={{ maxWidth: 900 }}
        onSubmit={(e) => {
          e.preventDefault();
          if (rows === null) return;
          saveMut.mutate();
        }}
      >
        <h2 id={headingId} ref={headingRef} tabIndex={-1} className="card-title">
          {t("projectPlan.blueprintTasksTitle", { name })}
        </h2>
        <p className="muted">{t("projectPlan.blueprintTasksHint")}</p>
        {rows === null && !q.isError && <p className="muted">{t("projectPlan.loading")}</p>}
        {q.isError && (
          <div className="alert alert-error" style={{ marginTop: "var(--space-3)" }}>
            {t("projectPlan.loadError", {
              message: q.error instanceof Error ? q.error.message : String(q.error),
            })}
          </div>
        )}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-2)",
            marginTop: "var(--space-3)",
          }}
        >
          {rows?.map((row, i) => (
            <div key={row.key} className="row" style={{ gap: "var(--space-2)" }}>
              <input
                className="input"
                style={{ flex: 2 }}
                required
                maxLength={200}
                placeholder={t("projectPlan.taskTitle")}
                aria-label={t("projectPlan.taskTitle")}
                value={row.title}
                onChange={(e) => update(i, { title: e.target.value })}
              />
              <input
                className="input"
                style={{ width: 90 }}
                type="number"
                min={0}
                max={365}
                placeholder={t("projectPlan.daysBefore")}
                aria-label={t("projectPlan.daysBefore")}
                value={row.daysBefore}
                onChange={(e) => update(i, { daysBefore: e.target.value })}
              />
              <input
                className="input"
                required={row.linkUrl.trim() !== ""}
                maxLength={100}
                placeholder={t("projectPlan.taskLinkLabel")}
                aria-label={t("projectPlan.taskLinkLabel")}
                value={row.linkLabel}
                onChange={(e) => update(i, { linkLabel: e.target.value })}
              />
              <input
                className="input"
                type="url"
                pattern="https://.*"
                required={row.linkLabel.trim() !== ""}
                maxLength={2000}
                placeholder={t("projectPlan.taskLinkUrl")}
                aria-label={t("projectPlan.taskLinkUrl")}
                value={row.linkUrl}
                onChange={(e) => update(i, { linkUrl: e.target.value })}
              />
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setRows((r) => r?.filter((_, idx) => idx !== i) ?? null)}
              >
                {t("projectPlan.delete")}
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          style={{ marginTop: "var(--space-3)" }}
          disabled={rows === null}
          onClick={() =>
            setRows((r) => [
              ...(r ?? []),
              { key: crypto.randomUUID(), title: "", daysBefore: "", linkLabel: "", linkUrl: "" },
            ])
          }
        >
          + {t("projectPlan.addTask")}
        </button>
        {saveMut.error instanceof Error && (
          <div className="alert alert-error" style={{ marginTop: "var(--space-3)" }}>
            {saveMut.error.message}
          </div>
        )}
        <div
          className="row"
          style={{ gap: "var(--space-2)", marginTop: "var(--space-4)", justifyContent: "flex-end" }}
        >
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t("projectPlan.cancel")}
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={rows === null || saveMut.isPending}
          >
            {t("projectPlan.save")}
          </button>
        </div>
      </form>
    </div>
  );
}
