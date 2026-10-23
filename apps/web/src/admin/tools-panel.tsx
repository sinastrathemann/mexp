import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../api/client";
import type { ToolLinkDto } from "../events/project-plan-types";

// Client-Zeile: key ist nur für React (stabil, auch bei neuen Zeilen) und wird nicht gespeichert.
interface Row extends ToolLinkDto {
  key: string;
}

function toRow(tool: ToolLinkDto): Row {
  return { ...tool, key: tool.id ?? crypto.randomUUID() };
}

function toDto(r: Row): ToolLinkDto {
  // exactOptionalPropertyTypes: id nur setzen, wenn vorhanden.
  return { ...(r.id === undefined ? {} : { id: r.id }), label: r.label, url: r.url };
}

export function ToolsPanel() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["tools"],
    queryFn: () => apiFetch<{ tools: ToolLinkDto[] }>("/tools"),
    refetchOnWindowFocus: false, // Editor: ungespeicherte Eingaben nicht überschreiben
  });
  // null = noch nicht aus den Serverdaten übernommen
  const [rows, setRows] = useState<Row[] | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (rows === null && q.data) setRows(q.data.tools.map(toRow));
  }, [rows, q.data]);

  const saveMut = useMutation({
    mutationFn: (tools: Row[]) =>
      apiFetch<{ tools: ToolLinkDto[] }>("/tools", {
        method: "PUT",
        body: JSON.stringify({ tools: tools.map(toDto) }),
      }),
    onSuccess: (data) => {
      qc.setQueryData(["tools"], data);
      // Server-IDs für neue Zeilen übernehmen, sonst vergibt jedes Speichern neue IDs
      setRows(data.tools.map(toRow));
      setSaved(true);
    },
  });

  const update = (i: number, patch: Partial<ToolLinkDto>) => {
    setSaved(false);
    setRows((r) => r?.map((row, idx) => (idx === i ? { ...row, ...patch } : row)) ?? null);
  };
  const move = (i: number, dir: -1 | 1) => {
    setSaved(false);
    setRows((r) => {
      if (r === null) return r;
      const next = [...r];
      const j = i + dir;
      if (j < 0 || j >= next.length) return r;
      [next[i], next[j]] = [next[j] as Row, next[i] as Row];
      return next;
    });
  };

  return (
    <div className="card">
      <h2 className="card-title">{t("projectPlan.adminToolsTitle")}</h2>
      <p className="muted">{t("projectPlan.adminToolsHint")}</p>
      {rows === null && !q.isError && <p className="muted">{t("projectPlan.loading")}</p>}
      {q.isError && (
        <div className="alert alert-error" style={{ marginTop: "var(--space-3)" }}>
          {t("projectPlan.loadError", {
            message: q.error instanceof Error ? q.error.message : String(q.error),
          })}
        </div>
      )}
      <div className="stack" style={{ gap: "var(--space-2)", marginTop: "var(--space-3)" }}>
        {rows?.map((row, i) => (
          <div key={row.key} className="row" style={{ gap: "var(--space-2)" }}>
            <input
              className="input"
              aria-label={t("projectPlan.toolLabel")}
              placeholder={t("projectPlan.toolLabel")}
              value={row.label}
              maxLength={100}
              onChange={(e) => update(i, { label: e.target.value })}
            />
            <input
              className="input"
              style={{ flex: 2 }}
              aria-label={t("projectPlan.toolUrl")}
              placeholder="https://…"
              value={row.url}
              maxLength={2000}
              onChange={(e) => update(i, { url: e.target.value })}
            />
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => move(i, -1)}
              title={t("projectPlan.moveUp")}
              aria-label={t("projectPlan.moveUp")}
            >
              ↑
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => move(i, 1)}
              title={t("projectPlan.moveDown")}
              aria-label={t("projectPlan.moveDown")}
            >
              ↓
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setSaved(false);
                setRows((r) => r?.filter((_, idx) => idx !== i) ?? null);
              }}
            >
              {t("projectPlan.delete")}
            </button>
          </div>
        ))}
      </div>
      <div className="row" style={{ gap: "var(--space-2)", marginTop: "var(--space-3)" }}>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          disabled={rows === null}
          onClick={() => {
            setSaved(false);
            setRows((r) => [
              ...(r ?? []),
              { key: crypto.randomUUID(), label: "", url: "https://" },
            ]);
          }}
        >
          + {t("projectPlan.addTool")}
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={rows === null || saveMut.isPending}
          onClick={() => rows && saveMut.mutate(rows)}
        >
          {t("projectPlan.save")}
        </button>
        {saved && <span className="muted">✓ {t("projectPlan.saved")}</span>}
      </div>
      {saveMut.error instanceof Error && (
        <div className="alert alert-error" style={{ marginTop: "var(--space-3)" }}>
          {saveMut.error.message}
        </div>
      )}
    </div>
  );
}
