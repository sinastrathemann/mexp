import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../api/client";
import type { ToolLinkDto } from "../events/project-plan-types";

export function ToolsPanel() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["tools"],
    queryFn: () => apiFetch<{ tools: ToolLinkDto[] }>("/tools"),
  });
  const [rows, setRows] = useState<ToolLinkDto[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (q.data) setRows(q.data.tools);
  }, [q.data]);

  const saveMut = useMutation({
    mutationFn: (tools: ToolLinkDto[]) =>
      apiFetch<{ tools: ToolLinkDto[] }>("/tools", {
        method: "PUT",
        body: JSON.stringify({ tools }),
      }),
    onSuccess: (data) => {
      qc.setQueryData(["tools"], data);
      setSaved(true);
    },
  });

  const update = (i: number, patch: Partial<ToolLinkDto>) => {
    setSaved(false);
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  };
  const move = (i: number, dir: -1 | 1) => {
    setSaved(false);
    setRows((r) => {
      const next = [...r];
      const j = i + dir;
      if (j < 0 || j >= next.length) return r;
      [next[i], next[j]] = [next[j] as ToolLinkDto, next[i] as ToolLinkDto];
      return next;
    });
  };

  return (
    <div className="card">
      <h2 className="card-title">{t("projectPlan.adminToolsTitle")}</h2>
      <p className="muted">{t("projectPlan.adminToolsHint")}</p>
      <div className="stack" style={{ gap: "var(--space-2)", marginTop: "var(--space-3)" }}>
        {rows.map((row, i) => (
          <div key={row.id ?? `new-${i}`} className="row" style={{ gap: "var(--space-2)" }}>
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
            >
              ↑
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => move(i, 1)}
              title={t("projectPlan.moveDown")}
            >
              ↓
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setSaved(false);
                setRows((r) => r.filter((_, idx) => idx !== i));
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
          onClick={() => {
            setSaved(false);
            setRows((r) => [...r, { label: "", url: "https://" }]);
          }}
        >
          + {t("projectPlan.addTool")}
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={saveMut.isPending}
          onClick={() => saveMut.mutate(rows)}
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
