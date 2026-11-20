import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hubAuthMiddleware } from "@mexp/auth";
import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";

// Feedback-Runde 6 (Punkt 15): Event duplizieren inkl. Formular, Aufgaben, Planungsdaten.
process.env.MEXP_DATA_DIR = mkdtempSync(join(tmpdir(), "mexp-duplicate-"));
process.env.AUTH_MODE = "hub";
Reflect.deleteProperty(process.env, "DATABASE_URL");

const { mexpUserStore } = await import("../src/routes/_user-resolution.js");
const { eventRoutes, devCreatedEventsStore } = await import("../src/routes/events.js");
const { eventTaskStore, eventPlanMetaStore } = await import("../src/project-plan/model.js");
const { devFormStore, devAnswerStore } = await import("../src/routes/registration-form.js");
const { errorHandler } = await import("../src/error-handler.js");

function app() {
  const a = new Hono();
  a.onError(errorHandler);
  a.use("*", hubAuthMiddleware());
  a.route("/api/events", eventRoutes);
  return a;
}

function asUser(id: string, roles: string[]) {
  const now = new Date().toISOString();
  mexpUserStore.set(id, {
    id,
    email: `${id}@mindsquare.de`,
    displayName: `Name ${id}`,
    roles,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });
  return {
    "X-MSQ-User-Id": id,
    "X-MSQ-User-Email": `${id}@mindsquare.de`,
    "Content-Type": "application/json",
  };
}

const SOURCE = {
  id: "src",
  title: "Managermeeting IT4IT",
  description: "<p>Projektumsetzung</p>",
  eventType: "management_circle",
  visibility: "internal",
  status: "open",
  startAt: "2027-03-10T09:00:00.000Z",
  endAt: "2027-03-10T17:00:00.000Z",
  timeTbd: false,
  location: "Bielefeld",
  locationDetails: null,
  capacity: 30,
  registrationDeadline: null,
  ownerId: "x",
  audienceScope: "emails",
  audienceRoles: [],
  audienceEmails: ["a@mindsquare.de"],
  audienceTeams: [],
  audienceDepartments: [],
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
};

function seed() {
  devCreatedEventsStore.set("src", { ...SOURCE } as never);
  devFormStore.set("src", [
    {
      id: "q1",
      order: 0,
      type: "yes_no",
      label: "Bist du dabei?",
      required: true,
      options: [],
      attendance: true,
    },
    { id: "q2", order: 1, type: "free_text", label: "Essen?", required: false, options: [] },
  ]);
  eventTaskStore.set("src", [
    {
      id: "t1",
      title: "Raum buchen",
      startDate: "2027-01-01",
      dueDate: "2027-02-01",
      priority: "high",
      assigneeId: "u1",
      assigneeName: "Mareike",
      linkLabel: null,
      linkUrl: null,
      done: true,
      doneBy: "u1",
      doneAt: "2026-11-02T00:00:00.000Z",
      createdBy: "x",
      createdAt: "2026-11-01T00:00:00.000Z",
    },
  ]);
  eventPlanMetaStore.set("src", {
    responsibleId: "u1",
    exmNote: "intern",
    kind: "event",
    targetCount: "30 Manager",
    targetCategories: [1, 2],
    recurrence: "W",
    goalReached: "reached",
    alternativeDate: "2027-03-17",
    updatedBy: "x",
    updatedAt: "2026-11-01T00:00:00.000Z",
  });
}

async function duplicate(headers: Record<string, string>, body: object = {}) {
  return app().request("/api/events/src/duplicate", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("Event duplizieren (Runde 6)", () => {
  beforeEach(() => {
    mexpUserStore.clear();
    devCreatedEventsStore.clear();
    eventTaskStore.clear();
    eventPlanMetaStore.clear();
    devFormStore.clear();
    devAnswerStore.clear();
    seed();
  });

  it("kopiert Event-Daten mit neuem Datum als Entwurf", async () => {
    const res = await duplicate(asUser("exm", ["event_office"]), {
      startAt: "2027-09-10T09:00:00.000Z",
      endAt: "2027-09-10T17:00:00.000Z",
    });
    expect(res.status).toBe(201);
    const { event } = (await res.json()) as { event: Record<string, unknown> };
    expect(event.id).not.toBe("src");
    expect(event.title).toBe("Managermeeting IT4IT (Kopie)");
    expect(event.status).toBe("draft");
    expect(event.eventType).toBe("management_circle");
    expect(event.startAt).toBe("2027-09-10T09:00:00.000Z");
    expect(event.audienceScope).toBe("emails");
    expect(event.audienceEmails).toEqual(["a@mindsquare.de"]);
  });

  it("kopiert Formular mit neuen Frage-IDs", async () => {
    const res = await duplicate(asUser("exm", ["event_office"]));
    const { event } = (await res.json()) as { event: { id: string } };
    const questions = devFormStore.get(event.id) ?? [];
    expect(questions.map((q) => q.label)).toEqual(["Bist du dabei?", "Essen?"]);
    expect(questions[0]?.attendance).toBe(true);
    expect(questions.some((q) => q.id === "q1" || q.id === "q2")).toBe(false);
  });

  it("kopiert Aufgaben zurückgesetzt (offen, ohne Daten), Zuständige bleiben", async () => {
    const res = await duplicate(asUser("exm", ["event_office"]));
    const { event } = (await res.json()) as { event: { id: string } };
    const [task] = eventTaskStore.get(event.id) ?? [];
    expect(task?.title).toBe("Raum buchen");
    expect(task?.id).not.toBe("t1");
    expect(task?.done).toBe(false);
    expect(task?.doneBy).toBeNull();
    expect(task?.doneAt).toBeNull();
    expect(task?.dueDate).toBeNull();
    expect(task?.startDate ?? null).toBeNull();
    expect(task?.assigneeId).toBe("u1");
    expect(task?.priority).toBe("high");
  });

  it("kopiert Planungsdaten ohne Ergebnis und Alternativtermin", async () => {
    const res = await duplicate(asUser("exm", ["event_office"]));
    const { event } = (await res.json()) as { event: { id: string } };
    const meta = eventPlanMetaStore.get(event.id);
    expect(meta?.targetCount).toBe("30 Manager");
    expect(meta?.recurrence).toBe("W");
    expect(meta?.responsibleId).toBe("u1");
    expect(meta?.goalReached ?? null).toBeNull();
    expect(meta?.alternativeDate ?? null).toBeNull();
  });

  it("Folgefragen verweisen in der Kopie auf die neuen Frage-IDs", async () => {
    const form = devFormStore.get("src") ?? [];
    devFormStore.set("src", [
      form[0] as never,
      { ...(form[1] as object), showIf: { questionId: "q1", equals: true } } as never,
    ]);
    const res = await duplicate(asUser("exm", ["event_office"]));
    const { event } = (await res.json()) as { event: { id: string } };
    const [first, second] = devFormStore.get(event.id) ?? [];
    expect(second?.showIf?.questionId).toBe(first?.id);
  });

  it("Original bleibt unverändert", async () => {
    const before = JSON.stringify([
      devCreatedEventsStore.get("src"),
      devFormStore.get("src"),
      eventTaskStore.get("src"),
      eventPlanMetaStore.get("src"),
    ]);
    await duplicate(asUser("exm", ["event_office"]));
    expect(
      JSON.stringify([
        devCreatedEventsStore.get("src"),
        devFormStore.get("src"),
        eventTaskStore.get("src"),
        eventPlanMetaStore.get("src"),
      ]),
    ).toBe(before);
  });

  it("Mitarbeitende dürfen nicht duplizieren", async () => {
    const res = await duplicate(asUser("ma", ["employee"]));
    expect(res.status).toBe(403);
  });
});
