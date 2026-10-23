import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../api/client";
import { useAuth } from "../auth/auth-context";
import type { AssigneeDto, EventTaskDto } from "./project-plan-types";
import { isOverdue, sortTasks, taskProgress, todayIso } from "./task-utils";

interface Draft {
  title: string;
  dueDate: string;
  assigneeId: string;
  linkLabel: string;
  linkUrl: string;
}

const emptyDraft: Draft = { title: "", dueDate: "", assigneeId: "", linkLabel: "", linkUrl: "" };

function toDraft(task: EventTaskDto): Draft {
  return {
    title: task.title,
    dueDate: task.dueDate ?? "",
    assigneeId: task.assigneeId ?? "",
    linkLabel: task.linkLabel ?? "",
    linkUrl: task.linkUrl ?? "",
  };
}

function toPayload(d: Draft) {
  const hasLink = d.linkLabel.trim() !== "" || d.linkUrl.trim() !== "";
  return {
    title: d.title.trim(),
    dueDate: d.dueDate || null,
    assigneeId: d.assigneeId || null,
    linkLabel: hasLink ? d.linkLabel.trim() : null,
    linkUrl: hasLink ? d.linkUrl.trim() : null,
  };
}

function fmtDay(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("de-DE");
}

export function TaskChecklist({ eventId }: { eventId: string }) {
  const { t } = useTranslation();
  const { hasRole } = useAuth();
  const canDelete = hasRole("admin");
  const qc = useQueryClient();
  const key = ["events", eventId, "tasks"];
  const today = todayIso();

  const tasksQ = useQuery({
    queryKey: key,
    queryFn: () => apiFetch<{ tasks: EventTaskDto[] }>(`/events/${eventId}/tasks`),
  });
  const assigneesQ = useQuery({
    queryKey: ["events", eventId, "task-assignees"],
    queryFn: () => apiFetch<{ assignees: AssigneeDto[] }>(`/events/${eventId}/task-assignees`),
  });

  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const invalidate = () => qc.invalidateQueries({ queryKey: key });

  const saveMut = useMutation({
    mutationFn: ({ id, body }: { id: string | "new"; body: object }) =>
      id === "new"
        ? apiFetch(`/events/${eventId}/tasks`, { method: "POST", body: JSON.stringify(body) })
        : apiFetch(`/events/${eventId}/tasks/${id}`, {
            method: "PATCH",
            body: JSON.stringify(body),
          }),
    onSuccess: () => {
      setEditingId(null);
      invalidate();
    },
  });
  const toggleMut = useMutation({
    mutationFn: (task: EventTaskDto) =>
      apiFetch(`/events/${eventId}/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ done: !task.done }),
      }),
    onSuccess: invalidate,
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/events/${eventId}/tasks/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const tasks = sortTasks(tasksQ.data?.tasks ?? []);
  const progress = taskProgress(tasks);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (editingId) saveMut.mutate({ id: editingId, body: toPayload(draft) });
  };

  const form = (
    <form onSubmit={submit} className="task-form">
      <input
        className="input"
        required
        maxLength={200}
        placeholder={t("projectPlan.taskTitle")}
        aria-label={t("projectPlan.taskTitle")}
        value={draft.title}
        onChange={(e) => setDraft({ ...draft, title: e.target.value })}
      />
      <input
        className="input"
        type="date"
        aria-label={t("projectPlan.taskDue")}
        value={draft.dueDate}
        onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })}
      />
      <select
        className="input"
        aria-label={t("projectPlan.taskAssignee")}
        value={draft.assigneeId}
        onChange={(e) => setDraft({ ...draft, assigneeId: e.target.value })}
      >
        <option value="">{t("projectPlan.taskNoAssignee")}</option>
        {(assigneesQ.data?.assignees ?? []).map((a) => (
          <option key={a.id} value={a.id}>
            {a.displayName}
          </option>
        ))}
      </select>
      <input
        className="input"
        maxLength={100}
        placeholder={t("projectPlan.taskLinkLabel")}
        aria-label={t("projectPlan.taskLinkLabel")}
        value={draft.linkLabel}
        onChange={(e) => setDraft({ ...draft, linkLabel: e.target.value })}
      />
      <input
        className="input"
        type="url"
        maxLength={2000}
        pattern="https://.*"
        placeholder={t("projectPlan.taskLinkUrl")}
        aria-label={t("projectPlan.taskLinkUrl")}
        value={draft.linkUrl}
        onChange={(e) => setDraft({ ...draft, linkUrl: e.target.value })}
      />
      <div className="row" style={{ gap: "var(--space-2)" }}>
        <button type="submit" className="btn btn-primary btn-sm" disabled={saveMut.isPending}>
          {t("projectPlan.save")}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            saveMut.reset();
            setEditingId(null);
          }}
        >
          {t("projectPlan.cancel")}
        </button>
      </div>
      {saveMut.error instanceof Error && (
        <div className="alert alert-error">{saveMut.error.message}</div>
      )}
    </form>
  );

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 className="card-title">{t("projectPlan.tasksTitle")}</h2>
        <span className="muted">
          {t("projectPlan.tasksProgress", { done: progress.done, total: progress.total })}
        </span>
      </div>
      <div className="task-progress" aria-hidden="true">
        <div className="task-progress-bar" style={{ width: `${progress.percent}%` }} />
      </div>

      {tasks.length === 0 && editingId !== "new" && (
        <p className="muted">{t("projectPlan.tasksEmpty")}</p>
      )}

      <ul className="task-list">
        {tasks.map((task) =>
          editingId === task.id ? (
            <li key={task.id}>{form}</li>
          ) : (
            <li key={task.id} className={`task-item${task.done ? " task-item--done" : ""}`}>
              <input
                type="checkbox"
                checked={task.done}
                aria-label={t("projectPlan.markDone")}
                disabled={toggleMut.isPending}
                onChange={() => toggleMut.mutate(task)}
              />
              <div className="task-main">
                <span className="task-title">{task.title}</span>
                <span className="muted text-xs">
                  {task.assigneeName ?? ""}
                  {task.assigneeName && task.dueDate ? " · " : ""}
                  {task.dueDate && (
                    <span className={isOverdue(task, today) ? "task-overdue" : undefined}>
                      {t("projectPlan.taskDueOn", { date: fmtDay(task.dueDate) })}
                      {isOverdue(task, today) ? ` · ${t("projectPlan.taskOverdue")}` : ""}
                    </span>
                  )}
                </span>
              </div>
              {task.linkUrl && (
                <a
                  href={task.linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline btn-sm"
                >
                  ↗ {task.linkLabel}
                </a>
              )}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  saveMut.reset();
                  setDraft(toDraft(task));
                  setEditingId(task.id);
                }}
              >
                {t("projectPlan.edit")}
              </button>
              {canDelete && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    if (window.confirm(t("projectPlan.confirmDeleteTask")))
                      deleteMut.mutate(task.id);
                  }}
                >
                  {t("projectPlan.delete")}
                </button>
              )}
            </li>
          ),
        )}
        {editingId === "new" && <li>{form}</li>}
      </ul>

      {toggleMut.error instanceof Error && (
        <div className="alert alert-error">{toggleMut.error.message}</div>
      )}
      {deleteMut.error instanceof Error && (
        <div className="alert alert-error">{deleteMut.error.message}</div>
      )}

      {editingId === null && (
        <button
          type="button"
          className="btn btn-outline btn-sm"
          style={{ marginTop: "var(--space-3)" }}
          onClick={() => {
            saveMut.reset();
            setDraft(emptyDraft);
            setEditingId("new");
          }}
        >
          + {t("projectPlan.addTask")}
        </button>
      )}
    </div>
  );
}
