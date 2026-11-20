import type { EventTaskDto, TaskPriority } from "./project-plan-types";

export const TASK_SORT_MODES = ["date", "priority", "manual"] as const;
export type TaskSortMode = (typeof TASK_SORT_MODES)[number];

const PRIORITY_RANK: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };

/**
 * Offene Aufgaben oben, erledigte darunter. Innerhalb der Gruppen:
 * - date: nach Fälligkeit (ohne Datum zuletzt)
 * - priority: hoch → mittel → niedrig, bei Gleichstand nach Fälligkeit
 * - manual: gespeicherte Reihenfolge (Array-Reihenfolge der API)
 */
export function sortTasks(tasks: EventTaskDto[], mode: TaskSortMode = "date"): EventTaskDto[] {
  const byDue = (a: EventTaskDto, b: EventTaskDto) => {
    if (a.dueDate === b.dueDate) return a.createdAt.localeCompare(b.createdAt);
    if (a.dueDate === null) return 1;
    if (b.dueDate === null) return -1;
    return a.dueDate.localeCompare(b.dueDate);
  };
  const byPriority = (a: EventTaskDto, b: EventTaskDto) =>
    PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || byDue(a, b);
  const cmp = mode === "priority" ? byPriority : mode === "date" ? byDue : null;
  const open = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);
  return cmp ? [...open.sort(cmp), ...done.sort(cmp)] : [...open, ...done];
}

/**
 * Verschiebt eine Aufgabe in der angezeigten Liste um eine Position (nur innerhalb
 * offen bzw. erledigt). Liefert die neue vollständige id-Reihenfolge oder null.
 */
export function moveTask(displayed: EventTaskDto[], id: string, delta: -1 | 1): string[] | null {
  const i = displayed.findIndex((t) => t.id === id);
  const j = i + delta;
  const a = displayed[i];
  const b = displayed[j];
  if (i < 0 || !a || !b || a.done !== b.done) return null;
  const ids = displayed.map((t) => t.id);
  ids[i] = b.id;
  ids[j] = a.id;
  return ids;
}

export function taskProgress(tasks: EventTaskDto[]) {
  const done = tasks.filter((t) => t.done).length;
  const total = tasks.length;
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}

export function isOverdue(task: EventTaskDto, today: string): boolean {
  return !task.done && task.dueDate !== null && task.dueDate < today;
}

/** „ab"-Datum noch nicht erreicht → Aufgabe wird gedimmt (Überfällig hängt nur an dueDate). */
export function isNotYetDue(task: EventTaskDto, today: string): boolean {
  return !task.done && task.startDate !== null && task.startDate > today;
}

/** Heutiges Datum in lokaler Zeit als YYYY-MM-DD. */
export function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
