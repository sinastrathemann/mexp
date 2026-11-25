import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hubAuthMiddleware } from "@mexp/auth";
import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";

// Runde 7 (Punkt 21): Event ohne Termin anlegen (Terminumfrage läuft noch).
// Ohne Termin bleibt es ein Entwurf; veröffentlichen erst mit Termin.
process.env.MEXP_DATA_DIR = mkdtempSync(join(tmpdir(), "mexp-no-date-"));
process.env.AUTH_MODE = "hub";
Reflect.deleteProperty(process.env, "DATABASE_URL");

const { mexpUserStore } = await import("../src/routes/_user-resolution.js");
const { eventRoutes, devCreatedEventsStore, devEventOverrideStore } = await import(
  "../src/routes/events.js"
);
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

const exm = () => asUser("exm", ["event_office"]);

async function createNoDate() {
  const res = await app().request("/api/events", {
    method: "POST",
    headers: exm(),
    body: JSON.stringify({
      title: "Sommerfest (Terminumfrage läuft)",
      eventType: "feelgood",
      startAt: null,
      endAt: null,
    }),
  });
  expect(res.status).toBe(201);
  return ((await res.json()) as { event: { id: string; startAt: string | null } }).event;
}

const patchStatus = (id: string, status: string) =>
  app().request(`/api/events/${id}/status`, {
    method: "PATCH",
    headers: exm(),
    body: JSON.stringify({ status }),
  });

describe("Event ohne Termin (Runde 7)", () => {
  beforeEach(() => {
    mexpUserStore.clear();
    devCreatedEventsStore.clear();
    devEventOverrideStore.clear();
  });

  it("lässt sich ohne Termin anlegen und liefert startAt/endAt null", async () => {
    const event = await createNoDate();
    expect(event.startAt).toBeNull();
    const res = await app().request(`/api/events/${event.id}`, { headers: exm() });
    const { event: loaded } = (await res.json()) as {
      event: { startAt: string | null; endAt: string | null; status: string };
    };
    expect(loaded).toMatchObject({ startAt: null, endAt: null, status: "draft" });
  });

  it("Start ohne Ende (oder umgekehrt) wird abgelehnt", async () => {
    const res = await app().request("/api/events", {
      method: "POST",
      headers: exm(),
      body: JSON.stringify({
        title: "X",
        eventType: "team",
        startAt: "2027-03-10T10:00:00.000Z",
        endAt: null,
      }),
    });
    expect(res.status).toBe(400);
  });

  it("ohne Termin nicht veröffentlichen (Status bleibt Entwurf)", async () => {
    const event = await createNoDate();
    const res = await patchStatus(event.id, "planned");
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("DATE_REQUIRED");
  });

  it("Sammel-Statuswechsel überspringt Events ohne Termin", async () => {
    const event = await createNoDate();
    const res = await app().request("/api/events/bulk/status", {
      method: "POST",
      headers: exm(),
      body: JSON.stringify({ eventIds: [event.id], status: "open" }),
    });
    const body = (await res.json()) as { results: { ok: boolean; error?: string }[] };
    expect(body.results[0]).toMatchObject({ ok: false, error: "DATE_REQUIRED" });
  });

  it("mit nachgetragenem Termin geht Veröffentlichen", async () => {
    const event = await createNoDate();
    const patch = await app().request(`/api/events/${event.id}`, {
      method: "PATCH",
      headers: exm(),
      body: JSON.stringify({
        startAt: "2027-06-20T16:00:00.000Z",
        endAt: "2027-06-20T22:00:00.000Z",
        timeTbd: false,
      }),
    });
    expect(patch.status).toBe(200);
    expect((await patchStatus(event.id, "planned")).status).toBe(200);
  });

  it("Termin bei veröffentlichtem Event nicht wieder entfernen", async () => {
    const event = await createNoDate();
    await app().request(`/api/events/${event.id}`, {
      method: "PATCH",
      headers: exm(),
      body: JSON.stringify({
        startAt: "2027-06-20T16:00:00.000Z",
        endAt: "2027-06-20T22:00:00.000Z",
      }),
    });
    await patchStatus(event.id, "planned");
    const res = await app().request(`/api/events/${event.id}`, {
      method: "PATCH",
      headers: exm(),
      body: JSON.stringify({ startAt: null, endAt: null }),
    });
    expect(res.status).toBe(400);
  });

  it("Kalenderdatei gibt es ohne Termin nicht", async () => {
    const event = await createNoDate();
    const res = await app().request(`/api/events/${event.id}/calendar.ics`, { headers: exm() });
    expect(res.status).toBe(404);
  });

  it("Duplizieren ohne Datum ergibt eine Kopie ohne Termin", async () => {
    const event = await createNoDate();
    const res = await app().request(`/api/events/${event.id}/duplicate`, {
      method: "POST",
      headers: exm(),
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(201);
    const { event: copy } = (await res.json()) as { event: { startAt: string | null } };
    expect(copy.startAt).toBeNull();
  });
});
