import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

// Vor dem Import setzen — dev-persistence liest MEXP_DATA_DIR beim Modul-Laden.
process.env.MEXP_DATA_DIR = mkdtempSync(join(tmpdir(), "mexp-project-plan-model-"));

const {
  DEFAULT_TOOLS,
  blueprintTaskStore,
  computeDueDate,
  copyBlueprintTasksToEvent,
  eventTaskStore,
  getTools,
  httpsUrlSchema,
  toolStore,
} = await import("../src/project-plan/model.js");

describe("computeDueDate", () => {
  it("zieht die Tage vom Event-Start ab und liefert ein Datum ohne Uhrzeit", () => {
    expect(computeDueDate("2027-06-20T16:00:00.000Z", 14)).toBe("2027-06-06");
  });
  it("liefert den Event-Tag bei 0 Tagen", () => {
    expect(computeDueDate("2027-06-20T16:00:00.000Z", 0)).toBe("2027-06-20");
  });
  it("liefert null ohne Tageswert", () => {
    expect(computeDueDate("2027-06-20T16:00:00.000Z", null)).toBeNull();
  });
});

describe("httpsUrlSchema", () => {
  it("akzeptiert https", () => {
    expect(httpsUrlSchema.safeParse("https://personal-hub.mindsquare.de/x/").success).toBe(true);
  });
  it("lehnt http und javascript: ab", () => {
    expect(httpsUrlSchema.safeParse("http://example.com").success).toBe(false);
    expect(httpsUrlSchema.safeParse("javascript:alert(1)").success).toBe(false);
  });
});

describe("getTools", () => {
  beforeEach(() => toolStore.clear());
  it("liefert die Vorbelegung, solange nie gespeichert wurde", () => {
    expect(getTools()).toEqual(DEFAULT_TOOLS);
    expect(DEFAULT_TOOLS.map((t) => t.label)).toEqual([
      "Coworking-Copilot",
      "Budget-Control-Agent",
    ]);
  });
  it("liefert eine gespeicherte (auch leere) Liste", () => {
    toolStore.set("default", { tools: [], updatedBy: "u1", updatedAt: "2026-10-23T00:00:00.000Z" });
    expect(getTools()).toEqual([]);
  });
});

describe("copyBlueprintTasksToEvent", () => {
  beforeEach(() => {
    blueprintTaskStore.clear();
    eventTaskStore.clear();
  });
  it("kopiert Aufgaben mit berechneter Fälligkeit und hängt an bestehende an", () => {
    blueprintTaskStore.set("bp1", [
      {
        id: "b1",
        title: "Coworking buchen",
        daysBefore: 30,
        linkLabel: "Coworking-Copilot",
        linkUrl: "https://personal-hub.mindsquare.de/coworking-copilot/",
      },
      {
        id: "b2",
        title: "Einladung verschicken",
        daysBefore: null,
        linkLabel: null,
        linkUrl: null,
      },
    ]);
    const copied = copyBlueprintTasksToEvent("bp1", "evt1", "2027-06-20T16:00:00.000Z", "u1");
    expect(copied).toHaveLength(2);
    expect(copied[0]).toMatchObject({
      title: "Coworking buchen",
      dueDate: "2027-05-21",
      done: false,
      createdBy: "u1",
      linkUrl: "https://personal-hub.mindsquare.de/coworking-copilot/",
    });
    expect(copied[1]).toMatchObject({ title: "Einladung verschicken", dueDate: null });
    expect(copied[0]?.id).not.toBe("b1");
    expect(eventTaskStore.get("evt1")).toHaveLength(2);
  });
  it("macht nichts ohne Blueprint-Aufgaben", () => {
    expect(copyBlueprintTasksToEvent("bp-x", "evt1", "2027-06-20T16:00:00.000Z", "u1")).toEqual([]);
    expect(eventTaskStore.has("evt1")).toBe(false);
  });
});
