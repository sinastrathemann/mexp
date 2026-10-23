import { afterEach, describe, expect, it, vi } from "vitest";
import type { EventTaskDto } from "./project-plan-types";
import { isOverdue, sortTasks, taskProgress, todayIso } from "./task-utils";

function task(id: string, over: Partial<EventTaskDto> = {}): EventTaskDto {
  return {
    id,
    title: id,
    dueDate: null,
    assigneeId: null,
    assigneeName: null,
    linkLabel: null,
    linkUrl: null,
    done: false,
    doneBy: null,
    doneAt: null,
    createdBy: "u",
    createdAt: "2026-10-01T00:00:00.000Z",
    ...over,
  };
}

describe("sortTasks", () => {
  it("offene nach Fälligkeit, ohne Datum danach, erledigte zuletzt", () => {
    const sorted = sortTasks([
      task("done", { done: true, dueDate: "2026-01-01" }),
      task("noDate"),
      task("late", { dueDate: "2026-12-01" }),
      task("early", { dueDate: "2026-11-01" }),
    ]);
    expect(sorted.map((t) => t.id)).toEqual(["early", "late", "noDate", "done"]);
  });
  it("gleiches Datum: früher angelegt zuerst", () => {
    const sorted = sortTasks([
      task("b", { dueDate: "2026-11-01", createdAt: "2026-10-02T00:00:00.000Z" }),
      task("a", { dueDate: "2026-11-01", createdAt: "2026-10-01T00:00:00.000Z" }),
    ]);
    expect(sorted.map((t) => t.id)).toEqual(["a", "b"]);
  });
  it("erledigte untereinander ebenfalls nach Fälligkeit", () => {
    const sorted = sortTasks([
      task("late", { done: true, dueDate: "2026-12-01" }),
      task("none", { done: true }),
      task("early", { done: true, dueDate: "2026-11-01" }),
    ]);
    expect(sorted.map((t) => t.id)).toEqual(["early", "late", "none"]);
  });
  it("verändert das Eingabe-Array nicht", () => {
    const input = [task("b", { dueDate: "2026-12-01" }), task("a", { dueDate: "2026-11-01" })];
    sortTasks(input);
    expect(input.map((t) => t.id)).toEqual(["b", "a"]);
  });
});

describe("taskProgress", () => {
  it("zählt erledigte", () => {
    expect(taskProgress([task("a", { done: true }), task("b")])).toEqual({
      done: 1,
      total: 2,
      percent: 50,
    });
  });
  it("rundet 1 von 3 auf 33 %", () => {
    expect(taskProgress([task("a", { done: true }), task("b"), task("c")]).percent).toBe(33);
  });
  it("0 % bei leerer Liste", () => {
    expect(taskProgress([])).toEqual({ done: 0, total: 0, percent: 0 });
  });
});

describe("isOverdue", () => {
  it("offen und Fälligkeit vor heute", () => {
    expect(isOverdue(task("a", { dueDate: "2026-10-22" }), "2026-10-23")).toBe(true);
  });
  it("heute fällig ist nicht überfällig", () => {
    expect(isOverdue(task("a", { dueDate: "2026-10-23" }), "2026-10-23")).toBe(false);
  });
  it("erledigt oder ohne Datum nie überfällig", () => {
    expect(isOverdue(task("a", { dueDate: "2026-01-01", done: true }), "2026-10-23")).toBe(false);
    expect(isOverdue(task("a"), "2026-10-23")).toBe(false);
  });
});

describe("todayIso", () => {
  afterEach(() => {
    vi.useRealTimers();
  });
  it("nutzt lokale Zeit auch kurz vor Mitternacht", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 23, 23, 59));
    expect(todayIso()).toBe("2026-10-23");
  });
});
