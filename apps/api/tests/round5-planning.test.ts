import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hubAuthMiddleware } from "@mexp/auth";
import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";

// Feedback-Runde 5: Event/Projekt, Planungsfelder, Contentplan, Jahresplanung.
process.env.MEXP_DATA_DIR = mkdtempSync(join(tmpdir(), "mexp-round5-"));
process.env.AUTH_MODE = "hub";
Reflect.deleteProperty(process.env, "DATABASE_URL");

const { mexpUserStore } = await import("../src/routes/_user-resolution.js");
const { eventRoutes, devEventOverrideStore, devCreatedEventsStore } = await import(
  "../src/routes/events.js"
);
const { eventPlanMetaStore } = await import("../src/project-plan/model.js");
const { eventPlanMetaRoutes } = await import("../src/routes/event-plan-meta.js");
const { contentPlanRoutes, contentPlanStore } = await import("../src/routes/content-plan.js");
const { yearPlanRoutes, yearPlanStore } = await import("../src/routes/year-plan.js");
const { nrwHolidays, easterSunday } = await import("../src/project-plan/holidays.js");
const { errorHandler } = await import("../src/error-handler.js");

function app() {
  const a = new Hono();
  a.onError(errorHandler);
  a.use("*", hubAuthMiddleware());
  a.route("/api/events", eventRoutes);
  a.route("/api", eventPlanMetaRoutes);
  a.route("/api", contentPlanRoutes);
  a.route("/api", yearPlanRoutes);
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

const team = () => asUser("exm", ["event_office"]);
const OWN = new Set(["e1", "p1", "e2027", "e2026", "opt"]);
const ownIds = (list: { id: string }[]) =>
  list
    .map((e) => e.id)
    .filter((id) => OWN.has(id))
    .sort();
const participant = () => asUser("ma", ["employee"]);

function seedEvent(id: string, startAt = "2027-06-19T09:00:00.000Z") {
  devCreatedEventsStore.set(id, {
    id,
    title: `Titel ${id}`,
    status: "open",
    capacity: null,
    startAt,
    endAt: startAt,
  } as never);
}

function putMeta(id: string, body: unknown) {
  return app().request(`/api/events/${id}/plan-meta`, {
    method: "PUT",
    headers: team(),
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mexpUserStore.clear();
  devEventOverrideStore.clear();
  devCreatedEventsStore.clear();
  eventPlanMetaStore.clear();
  contentPlanStore.clear();
  yearPlanStore.clear();
});

describe("Event oder Projekt", () => {
  it("ohne Plan-Meta gilt jedes Event als Event mit leeren Planungsfeldern", async () => {
    seedEvent("e1");
    const res = await app().request("/api/events/e1/plan-meta", { headers: team() });
    const { meta } = await res.json();
    expect(meta).toMatchObject({
      kind: "event",
      targetCount: null,
      targetCategories: [],
      recurrence: null,
      goalReached: null,
      alternativeDate: null,
    });
    // Lesen legt nichts an
    expect(eventPlanMetaStore.has("e1")).toBe(false);
  });

  it("Planungsfelder speichern, Teil-Update lässt Rest stehen, Event-Datensatz bleibt gleich", async () => {
    seedEvent("e1");
    const before = JSON.stringify(devCreatedEventsStore.get("e1"));
    await putMeta("e1", {
      targetCount: "140 MA (60 C)",
      targetCategories: [3, 1, 1],
      recurrence: "W",
    });
    const res = await putMeta("e1", { goalReached: "exceeded" });
    const { meta } = await res.json();
    expect(meta).toMatchObject({
      kind: "event",
      targetCount: "140 MA (60 C)",
      targetCategories: [1, 3],
      recurrence: "W",
      goalReached: "exceeded",
    });
    expect(JSON.stringify(devCreatedEventsStore.get("e1"))).toBe(before);
    expect(devEventOverrideStore.has("e1")).toBe(false);
  });

  it("Projekt: für Teilnehmer unsichtbar (Liste + Detail), keine Anmeldung; Team sieht es", async () => {
    seedEvent("p1");
    seedEvent("e1");
    await putMeta("p1", { kind: "project" });

    const listMa = await (await app().request("/api/events", { headers: participant() })).json();
    expect(ownIds(listMa.events)).toEqual(["e1"]);
    expect((await app().request("/api/events/p1", { headers: participant() })).status).toBe(404);
    const reg = await app().request("/api/events/p1/register", {
      method: "POST",
      headers: participant(),
      body: JSON.stringify({ answers: [], personalNote: null }),
    });
    expect(reg.status).toBe(409);

    const listTeam = await (await app().request("/api/events", { headers: team() })).json();
    expect(ownIds(listTeam.events)).toEqual(["e1", "p1"]);
    const kinds = Object.fromEntries(
      listTeam.events.map((e: { id: string; kind: string }) => [e.id, e.kind]),
    );
    expect(kinds).toMatchObject({ e1: "event", p1: "project" });
    const detail = await app().request("/api/events/p1", { headers: team() });
    expect(detail.status).toBe(200);
    expect((await detail.json()).event.kind).toBe("project");
  });

  it("Teilnehmer dürfen Plan-Meta nicht lesen", async () => {
    const res = await app().request("/api/events/e1/plan-meta", { headers: participant() });
    expect(res.status).toBe(403);
  });
});

describe("Contentplan", () => {
  it("anlegen, nach Zeitraum filtern, ändern, löschen", async () => {
    const h = team();
    const create = (date: string, title: string) =>
      app().request("/api/content-plan", {
        method: "POST",
        headers: h,
        body: JSON.stringify({ date, title, channel: "mail", responsibleId: "exm", eventId: "e1" }),
      });
    const a = await (await create("2026-11-17", "Terminupdate final mindcon II")).json();
    await create("2026-12-01", "Adventskalender Türchen 1");
    expect(a.entry.responsibleName).toBe("Name exm");

    const week = await (
      await app().request("/api/content-plan?from=2026-11-16&to=2026-11-20", { headers: h })
    ).json();
    expect(week.entries.map((e: { title: string }) => e.title)).toEqual([
      "Terminupdate final mindcon II",
    ]);

    const patched = await app().request(`/api/content-plan/${a.entry.id}`, {
      method: "PATCH",
      headers: h,
      body: JSON.stringify({ channel: "teams", note: "mit Foto" }),
    });
    expect((await patched.json()).entry).toMatchObject({ channel: "teams", note: "mit Foto" });

    const del = await app().request(`/api/content-plan/${a.entry.id}`, {
      method: "DELETE",
      headers: h,
    });
    expect(del.status).toBe(204);
    expect(contentPlanStore.size).toBe(1);
  });

  it("nur Event-Team; Verantwortliche müssen zum Team gehören", async () => {
    expect((await app().request("/api/content-plan", { headers: participant() })).status).toBe(403);
    participant();
    const res = await app().request("/api/content-plan", {
      method: "POST",
      headers: team(),
      body: JSON.stringify({
        date: "2026-11-17",
        title: "x",
        channel: "mail",
        responsibleId: "ma",
      }),
    });
    expect(res.status).toBe(400);
  });
});

describe("Jahresplanung", () => {
  it("Ostern und NRW-Feiertage 2027", () => {
    expect(easterSunday(2027).toISOString().slice(0, 10)).toBe("2027-03-28");
    const h = nrwHolidays(2027);
    expect(h.find((x) => x.title === "Karfreitag")?.date).toBe("2027-03-26");
    expect(h.find((x) => x.title === "Fronleichnam")?.date).toBe("2027-05-27");
    expect(h).toHaveLength(11);
  });

  it("liefert interne Events des Jahres mit Plan-Meta, manuelle Termine und Feiertage", async () => {
    seedEvent("e2027");
    seedEvent("e2026", "2026-05-01T09:00:00.000Z");
    seedEvent("opt", "2026-12-30T09:00:00.000Z");
    await putMeta("e2027", { recurrence: "W", targetCount: "40 MA", exmNote: "geheim" });
    await putMeta("opt", { alternativeDate: "2027-01-08" });
    const created = await app().request("/api/year-plan/entries", {
      method: "POST",
      headers: team(),
      body: JSON.stringify({ kind: "external", title: "Boardmeeting", date: "2027-03-15" }),
    });
    expect(created.status).toBe(201);

    const res = await app().request("/api/year-plan?year=2027", { headers: team() });
    const body = await res.json();
    expect(ownIds(body.internal)).toEqual(["e2027", "opt"]);
    const e = body.internal.find((x: { id: string }) => x.id === "e2027");
    expect(e).toMatchObject({ recurrence: "W", targetCount: "40 MA", kind: "event" });
    expect(e.exmNote).toBeUndefined();
    expect(body.manual).toHaveLength(1);
    expect(body.holidays).toHaveLength(11);
  });

  it("nur Event-Team", async () => {
    const res = await app().request("/api/year-plan?year=2027", { headers: participant() });
    expect(res.status).toBe(403);
  });
});
