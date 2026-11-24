import { afterEach, describe, expect, it, vi } from "vitest";
import type { EventTaskDto } from "./project-plan-types";
import { isNotYetDue, isOverdue, moveTask, sortTasks, taskProgress, todayIso } from "./task-utils";

function task(id: string, over: Partial<EventTaskDto> = {}): EventTaskDto {
  return {
    id,
    title: id,
    dueDate: null,
    startDate: null,
    assigneeId: null,
    assigneeName: null,
    linkLabel: null,
    linkUrl: null,
    info: null,
    done: false,
    doneBy: null,
    doneAt: null,
    createdBy: "u",
    createdAt: "2026-10-01T00:00:00.000Z",
    priority: "medium",
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

describe("sortTasks nach Priorität und eigener Reihenfolge", () => {
  it("Priorität: hoch vor mittel vor niedrig, innerhalb nach Fälligkeit, erledigte zuletzt", () => {
    const sorted = sortTasks(
      [
        task("low", { priority: "low", dueDate: "2026-01-01" }),
        task("doneHigh", { priority: "high", done: true }),
        task("med", { priority: "medium" }),
        task("highLate", { priority: "high", dueDate: "2026-12-01" }),
        task("highEarly", { priority: "high", dueDate: "2026-11-01" }),
      ],
      "priority",
    );
    expect(sorted.map((t) => t.id)).toEqual(["highEarly", "highLate", "med", "low", "doneHigh"]);
  });
  it("eigene Reihenfolge: gespeicherte Reihenfolge, erledigte zuletzt", () => {
    const sorted = sortTasks(
      [task("c", { dueDate: "2026-01-01" }), task("done", { done: true }), task("a"), task("b")],
      "manual",
    );
    expect(sorted.map((t) => t.id)).toEqual(["c", "a", "b", "done"]);
  });
});

describe("moveTask", () => {
  const list = [task("a"), task("b"), task("c"), task("d", { done: true })];
  it("tauscht mit dem Nachbarn und liefert die vollständige id-Liste", () => {
    expect(moveTask(list, "b", -1)).toEqual(["b", "a", "c", "d"]);
    expect(moveTask(list, "b", 1)).toEqual(["a", "c", "b", "d"]);
  });
  it("am Rand oder über die Grenze offen/erledigt hinweg: null", () => {
    expect(moveTask(list, "a", -1)).toBeNull();
    expect(moveTask(list, "c", 1)).toBeNull();
    expect(moveTask(list, "x", 1)).toBeNull();
  });
});

describe("isNotYetDue (ab-Datum)", () => {
  const today = "2027-03-10";
  it("ab-Datum in der Zukunft → noch nicht fällig", () => {
    expect(isNotYetDue(task("a", { startDate: "2027-03-11" }), today)).toBe(true);
  });
  it("ab heute → fällig", () => {
    expect(isNotYetDue(task("a", { startDate: today }), today)).toBe(false);
  });
  it("erledigt → nie gedimmt", () => {
    expect(isNotYetDue(task("a", { startDate: "2027-04-01", done: true }), today)).toBe(false);
  });
  it("ohne ab-Datum → fällig", () => {
    expect(isNotYetDue(task("a"), today)).toBe(false);
  });
});
