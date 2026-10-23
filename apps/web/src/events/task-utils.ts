import type { EventTaskDto } from "./project-plan-types";

/** Offene Aufgaben nach Fälligkeit (ohne Datum zuletzt), erledigte darunter. */
export function sortTasks(tasks: EventTaskDto[]): EventTaskDto[] {
  const byDue = (a: EventTaskDto, b: EventTaskDto) => {
    if (a.dueDate === b.dueDate) return a.createdAt.localeCompare(b.createdAt);
    if (a.dueDate === null) return 1;
    if (b.dueDate === null) return -1;
    return a.dueDate.localeCompare(b.dueDate);
  };
  const open = tasks.filter((t) => !t.done).sort(byDue);
  const done = tasks.filter((t) => t.done).sort(byDue);
  return [...open, ...done];
}

export function taskProgress(tasks: EventTaskDto[]) {
  const done = tasks.filter((t) => t.done).length;
  const total = tasks.length;
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}

export function isOverdue(task: EventTaskDto, today: string): boolean {
  return !task.done && task.dueDate !== null && task.dueDate < today;
}

/** Heutiges Datum in lokaler Zeit als YYYY-MM-DD. */
export function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
