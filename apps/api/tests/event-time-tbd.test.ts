import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hubAuthMiddleware } from "@mexp/auth";
import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";

// Datei-Modus: keine Datenbank, temporäres Datenverzeichnis, Hub-Auth über Header.
process.env.MEXP_DATA_DIR = mkdtempSync(join(tmpdir(), "mexp-time-tbd-"));
process.env.AUTH_MODE = "hub";
Reflect.deleteProperty(process.env, "DATABASE_URL");

const { mexpUserStore } = await import("../src/routes/_user-resolution.js");
const { eventRoutes, devEventOverrideStore, devCreatedEventsStore } = await import(
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

function asAdmin() {
  const now = new Date().toISOString();
  mexpUserStore.set("admin-1", {
    id: "admin-1",
    email: "admin-1@mindsquare.de",
    displayName: "admin-1",
    roles: ["admin"],
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });
  return {
    "X-MSQ-User-Id": "admin-1",
    "X-MSQ-User-Email": "admin-1@mindsquare.de",
    "Content-Type": "application/json",
  };
}

async function createEvent(extra: Record<string, unknown>) {
  const res = await app().request("/api/events", {
    method: "POST",
    headers: asAdmin(),
    body: JSON.stringify({
      title: "Krimi-Dinner",
      eventType: "team",
      startAt: "2026-11-05T10:00:00.000Z",
      endAt: "2026-11-06T14:00:00.000Z",
      ...extra,
    }),
  });
  expect(res.status).toBe(201);
  return ((await res.json()) as { event: { id: string; timeTbd: boolean } }).event;
}

describe("Events mit offener Uhrzeit (timeTbd)", () => {
  beforeEach(() => {
    mexpUserStore.clear();
    devEventOverrideStore.clear();
    devCreatedEventsStore.clear();
  });

  it("speichert timeTbd beim Anlegen, Standard ist false", async () => {
    expect((await createEvent({ timeTbd: true })).timeTbd).toBe(true);
    expect((await createEvent({})).timeTbd).toBe(false);
  });

  it("timeTbd lässt sich über PATCH wieder entfernen", async () => {
    const evt = await createEvent({ timeTbd: true });
    const res = await app().request(`/api/events/${evt.id}`, {
      method: "PATCH",
      headers: asAdmin(),
      body: JSON.stringify({ timeTbd: false }),
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { event: { timeTbd: boolean } }).event.timeTbd).toBe(false);
  });

  it("Kalenderdatei: Ganztagstermin bei offener Uhrzeit", async () => {
    const evt = await createEvent({ timeTbd: true });
    const res = await app().request(`/api/events/${evt.id}/calendar.ics`, { headers: asAdmin() });
    const ics = await res.text();
    expect(ics).toContain("DTSTART;VALUE=DATE:20261105");
    // DTEND ist bei Ganztagsterminen exklusiv → Tag nach dem Enddatum
    expect(ics).toContain("DTEND;VALUE=DATE:20261107");
  });

  it("Kalenderdatei: mit Uhrzeit unverändert", async () => {
    const evt = await createEvent({});
    const res = await app().request(`/api/events/${evt.id}/calendar.ics`, { headers: asAdmin() });
    expect(await res.text()).toContain("DTSTART:20261105T100000Z");
  });
});
