import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../api/client";
import { useAuth } from "../auth/auth-context";
import {
  type AssigneeDto,
  type EventTaskDto,
  TASK_PRIORITIES,
  type TaskPriority,
} from "./project-plan-types";
import {
  TASK_SORT_MODES,
  type TaskSortMode,
  isNotYetDue,
  isOverdue,
  moveTask,
  sortTasks,
  taskProgress,
  todayIso,
} from "./task-utils";

// Sortierung ist eine persönliche Ansichts-Einstellung: nur im Browser gemerkt.
const SORT_STORAGE_KEY = "mexp.taskSort";
function loadSortMode(): TaskSortMode {
  try {
    const v = localStorage.getItem(SORT_STORAGE_KEY);
    return (TASK_SORT_MODES as readonly string[]).includes(v ?? "") ? (v as TaskSortMode) : "date";
  } catch {
    return "date";
  }
}
function saveSortMode(mode: TaskSortMode) {
  try {
    localStorage.setItem(SORT_STORAGE_KEY, mode);
  } catch {
    // Ohne Storage gilt die Wahl nur bis zum Neuladen
  }
}

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  high: "projectPlan.priorityHigh",
  medium: "projectPlan.priorityMedium",
  low: "projectPlan.priorityLow",
};

interface Draft {
  title: string;
  startDate: string;
  dueDate: string;
  priority: TaskPriority;
  assigneeId: string;
  linkLabel: string;
  linkUrl: string;
}

const emptyDraft: Draft = {
  title: "",
  startDate: "",
  dueDate: "",
  priority: "medium",
  assigneeId: "",
  linkLabel: "",
  linkUrl: "",
};

function toDraft(task: EventTaskDto): Draft {
  return {
    title: task.title,
    startDate: task.startDate ?? "",
    dueDate: task.dueDate ?? "",
    priority: task.priority,
    assigneeId: task.assigneeId ?? "",
    linkLabel: task.linkLabel ?? "",
    linkUrl: task.linkUrl ?? "",
  };
}

function toPayload(d: Draft) {
  const hasLink = d.linkLabel.trim() !== "" || d.linkUrl.trim() !== "";
  return {
    title: d.title.trim(),
    startDate: d.startDate || null,
    dueDate: d.dueDate || null,
    priority: d.priority,
    assigneeId: d.assigneeId || null,
    linkLabel: hasLink ? d.linkLabel.trim() : null,
    linkUrl: hasLink ? d.linkUrl.trim() : null,
  };
}

function fmtDay(iso: string, language: string) {
  const locale = language.startsWith("de") ? "de-DE" : "en-GB";
  return new Date(`${iso}T00:00:00`).toLocaleDateString(locale);
}

export function TaskChecklist({ eventId }: { eventId: string }) {
  const { t, i18n } = useTranslation();
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
    queryKey: ["task-assignees"],
    queryFn: () => apiFetch<{ assignees: AssigneeDto[] }>("/task-assignees"),
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
  const orderMut = useMutation({
    mutationFn: (ids: string[]) =>
      apiFetch(`/events/${eventId}/tasks/order`, { method: "PUT", body: JSON.stringify({ ids }) }),
    onSettled: invalidate,
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/events/${eventId}/tasks/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const [sortMode, setSortMode] = useState<TaskSortMode>(loadSortMode);
  const tasks = sortTasks(tasksQ.data?.tasks ?? [], sortMode);
  const move = (id: string, delta: -1 | 1) => {
    const ids = moveTask(tasks, id, delta);
    if (ids) orderMut.mutate(ids);
  };
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
      <label className="task-date-field">
        <span className="muted text-xs">{t("projectPlan.taskStart")}</span>
        <input
          className="input"
          type="date"
          aria-label={t("projectPlan.taskStart")}
          value={draft.startDate}
          max={draft.dueDate || undefined}
          onChange={(e) => setDraft({ ...draft, startDate: e.target.value })}
        />
      </label>
      <label className="task-date-field">
        <span className="muted text-xs">{t("projectPlan.taskDue")}</span>
        <input
          className="input"
          type="date"
          min={draft.startDate || undefined}
          aria-label={t("projectPlan.taskDue")}
          value={draft.dueDate}
          onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })}
        />
      </label>
      <select
        className="input"
        aria-label={t("projectPlan.taskPriority")}
        value={draft.priority}
        onChange={(e) => setDraft({ ...draft, priority: e.target.value as TaskPriority })}
      >
        {TASK_PRIORITIES.map((p) => (
          <option key={p} value={p}>
            {t("projectPlan.taskPriority")}: {t(PRIORITY_LABEL[p])}
          </option>
        ))}
      </select>
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
        required={draft.linkUrl.trim() !== ""}
        maxLength={100}
        placeholder={t("projectPlan.taskLinkLabel")}
        aria-label={t("projectPlan.taskLinkLabel")}
        value={draft.linkLabel}
        onChange={(e) => setDraft({ ...draft, linkLabel: e.target.value })}
      />
      <input
        className="input"
        type="url"
        required={draft.linkLabel.trim() !== ""}
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
      <div className="row" style={{ gap: "var(--space-2)", alignItems: "center" }}>
        <label className="muted text-xs" htmlFor={`task-sort-${eventId}`}>
          {t("projectPlan.sortBy")}
        </label>
        <select
          id={`task-sort-${eventId}`}
          className="select"
          style={{ width: "auto" }}
          value={sortMode}
          onChange={(e) => {
            const mode = e.target.value as TaskSortMode;
            setSortMode(mode);
            saveSortMode(mode);
          }}
        >
          <option value="date">{t("projectPlan.sortDate")}</option>
          <option value="priority">{t("projectPlan.sortPriority")}</option>
          <option value="manual">{t("projectPlan.sortManual")}</option>
        </select>
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
            <li
              key={task.id}
              className={`task-item${task.done ? " task-item--done" : ""}${isNotYetDue(task, today) ? " task-item--not-yet-due" : ""}`}
            >
              <input
                type="checkbox"
                checked={task.done}
                aria-label={`${t("projectPlan.markDone")}: ${task.title}`}
                disabled={toggleMut.isPending}
                onChange={() => {
                  deleteMut.reset();
                  toggleMut.mutate(task);
                }}
              />
              <div className="task-main">
                <span className="task-title">
                  {task.priority !== "medium" && (
                    <span
                      className={`badge ${task.priority === "high" ? "badge-danger" : "badge-muted"}`}
                      style={{ marginRight: "var(--space-2)" }}
                    >
                      {t(PRIORITY_LABEL[task.priority])}
                    </span>
                  )}
                  {task.title}
                </span>
                <span className="muted text-xs">
                  {task.assigneeName ?? ""}
                  {task.assigneeName && (task.startDate || task.dueDate) ? " · " : ""}
                  {task.startDate && (
                    <span>
                      {t("projectPlan.taskStartOn", {
                        date: fmtDay(task.startDate, i18n.language),
                      })}
                      {isNotYetDue(task, today) ? ` · ${t("projectPlan.taskNotYetDue")}` : ""}
                      {task.dueDate ? " – " : ""}
                    </span>
                  )}
                  {task.dueDate && (
                    <span className={isOverdue(task, today) ? "task-overdue" : undefined}>
                      {t("projectPlan.taskDueOn", { date: fmtDay(task.dueDate, i18n.language) })}
                      {isOverdue(task, today) ? ` · ${t("projectPlan.taskOverdue")}` : ""}
                    </span>
                  )}
                </span>
              </div>
              {sortMode === "manual" && (
                <>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    aria-label={`${t("projectPlan.moveUp")}: ${task.title}`}
                    title={t("projectPlan.moveUp")}
                    disabled={orderMut.isPending || moveTask(tasks, task.id, -1) === null}
                    onClick={() => move(task.id, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    aria-label={`${t("projectPlan.moveDown")}: ${task.title}`}
                    title={t("projectPlan.moveDown")}
                    disabled={orderMut.isPending || moveTask(tasks, task.id, 1) === null}
                    onClick={() => move(task.id, 1)}
                  >
                    ↓
                  </button>
                </>
              )}
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
                aria-label={`${t("projectPlan.edit")}: ${task.title}`}
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
                  aria-label={`${t("projectPlan.delete")}: ${task.title}`}
                  onClick={() => {
                    if (window.confirm(t("projectPlan.confirmDeleteTask"))) {
                      toggleMut.reset();
                      deleteMut.mutate(task.id);
                    }
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
        <div className="alert alert-error row" style={{ justifyContent: "space-between" }}>
          <span>{toggleMut.error.message}</span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            aria-label={t("projectPlan.dismiss")}
            onClick={() => toggleMut.reset()}
          >
            ×
          </button>
        </div>
      )}
      {orderMut.error instanceof Error && (
        <div className="alert alert-error row" style={{ justifyContent: "space-between" }}>
          <span>{orderMut.error.message}</span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            aria-label={t("projectPlan.dismiss")}
            onClick={() => orderMut.reset()}
          >
            ×
          </button>
        </div>
      )}
      {deleteMut.error instanceof Error && (
        <div className="alert alert-error row" style={{ justifyContent: "space-between" }}>
          <span>{deleteMut.error.message}</span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            aria-label={t("projectPlan.dismiss")}
            onClick={() => deleteMut.reset()}
          >
            ×
          </button>
        </div>
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
