import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hubAuthMiddleware } from "@mexp/auth";
import { Hono } from "hono";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

process.env.MEXP_DATA_DIR = mkdtempSync(join(tmpdir(), "mexp-event-archive-"));
process.env.AUTH_MODE = "hub";
Reflect.deleteProperty(process.env, "DATABASE_URL");

const { mexpUserStore } = await import("../src/routes/_user-resolution.js");
const { eventRoutes, devEventOverrideStore, devCreatedEventsStore } = await import(
  "../src/routes/events.js"
);
const { errorHandler } = await import("../src/error-handler.js");

const ONENOTE_ID = "onenote-team-mainova-20261201";

function app() {
  const a = new Hono();
  a.onError(errorHandler);
  a.use("*", hubAuthMiddleware());
  a.route("/api/events", eventRoutes);
  return a;
}

function as(id: string, roles: string[]) {
  const now = new Date().toISOString();
  mexpUserStore.set(id, {
    id,
    email: `${id}@mindsquare.de`,
    displayName: id,
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

async function listIds(headers: Record<string, string>, query = "") {
  const res = await app().request(`/api/events${query}`, { headers });
  expect(res.status).toBe(200);
  const body = (await res.json()) as { events: { id: string }[] };
  return body.events.map((e) => e.id);
}

describe("Event-Archiv im Datei-Modus", () => {
  beforeAll(() => {
    // OneNote-Events werden nur angezeigt, wenn sie in der Zukunft liegen
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-01T10:00:00.000Z"));
  });
  afterAll(() => vi.useRealTimers());

  beforeEach(() => {
    mexpUserStore.clear();
    devEventOverrideStore.clear();
    devCreatedEventsStore.clear();
    devCreatedEventsStore.set("live-1", {
      id: "live-1",
      title: "Live-Event ohne Archiv-Feld",
      status: "open",
      startAt: "2026-12-01T17:00:00.000Z",
      endAt: "2026-12-01T20:00:00.000Z",
    });
  });

  it("Event ohne _archived erscheint in der Standardliste (Schutz der Live-Daten)", async () => {
    const ids = await listIds(as("admin-1", ["admin"]));
    expect(ids).toContain("live-1");
    expect(await listIds(as("admin-1", ["admin"]), "?archived=true")).not.toContain("live-1");
  });

  it("OneNote-Events erscheinen nur mit ?archived=true", async () => {
    const headers = as("admin-1", ["admin"]);
    expect(await listIds(headers)).not.toContain(ONENOTE_ID);
    expect(await listIds(headers, "?archived=true")).toContain(ONENOTE_ID);
  });

  it("Admin archiviert und stellt wieder her, idempotent", async () => {
    const headers = as("admin-1", ["admin"]);
    for (let i = 0; i < 2; i++) {
      const res = await app().request("/api/events/live-1/archive", { method: "POST", headers });
      expect(res.status).toBe(200);
    }
    expect(await listIds(headers)).not.toContain("live-1");
    expect(await listIds(headers, "?archived=true")).toContain("live-1");

    const detail = await app().request("/api/events/live-1", { headers });
    expect(detail.status).toBe(200);
    expect(((await detail.json()) as { event: { archived: boolean } }).event.archived).toBe(true);

    const res = await app().request("/api/events/live-1/unarchive", { method: "POST", headers });
    expect(res.status).toBe(200);
    expect(await listIds(headers)).toContain("live-1");
  });

  it("OneNote-Event lässt sich wiederherstellen", async () => {
    const headers = as("admin-1", ["admin"]);
    const res = await app().request(`/api/events/${ONENOTE_ID}/unarchive`, {
      method: "POST",
      headers,
    });
    expect(res.status).toBe(200);
    expect(await listIds(headers)).toContain(ONENOTE_ID);
  });

  it("Nicht-Admins dürfen nicht archivieren (403)", async () => {
    for (const roles of [["werkstudent"], ["participant"]]) {
      const res = await app().request("/api/events/live-1/archive", {
        method: "POST",
        headers: as("user-x", roles),
      });
      expect(res.status).toBe(403);
    }
    expect(devEventOverrideStore.has("live-1")).toBe(false);
  });

  it("Unbekannte ID: 404 ohne Override-Eintrag", async () => {
    const res = await app().request("/api/events/gibt-es-nicht/archive", {
      method: "POST",
      headers: as("admin-1", ["admin"]),
    });
    expect(res.status).toBe(404);
    expect(devEventOverrideStore.has("gibt-es-nicht")).toBe(false);
  });
});
