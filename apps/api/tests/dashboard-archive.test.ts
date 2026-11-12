import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hubAuthMiddleware } from "@mexp/auth";
import { Hono } from "hono";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

process.env.MEXP_DATA_DIR = mkdtempSync(join(tmpdir(), "mexp-dashboard-archive-"));
process.env.AUTH_MODE = "hub";
Reflect.deleteProperty(process.env, "DATABASE_URL");

const { mexpUserStore } = await import("../src/routes/_user-resolution.js");
const { devEventOverrideStore, devCreatedEventsStore } = await import("../src/routes/events.js");
const { devLiveParticipantsStore } = await import("../src/routes/registration-form.js");
const { dashboardRoutes } = await import("../src/routes/dashboard.js");
const { errorHandler } = await import("../src/error-handler.js");

const ONENOTE_ID = "onenote-team-mainova-20261201";

function app() {
  const a = new Hono();
  a.onError(errorHandler);
  a.use("*", hubAuthMiddleware());
  a.route("/api/dashboard", dashboardRoutes);
  return a;
}

async function stats() {
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
  const res = await app().request("/api/dashboard/portfolio", {
    headers: { "X-MSQ-User-Id": "admin-1", "X-MSQ-User-Email": "admin-1@mindsquare.de" },
  });
  expect(res.status).toBe(200);
  return (
    (await res.json()) as {
      stats: { totalEvents: number; participationByStatus: Record<string, number> };
    }
  ).stats;
}

describe("Dashboard zählt archivierte Events nicht", () => {
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-01T10:00:00.000Z"));
  });
  afterAll(() => vi.useRealTimers());

  beforeEach(() => {
    mexpUserStore.clear();
    devEventOverrideStore.clear();
    devCreatedEventsStore.clear();
    devLiveParticipantsStore.clear();
    devCreatedEventsStore.set("live-1", { id: "live-1", status: "open" });
    devLiveParticipantsStore.set("live-1", [{ status: "registered" }] as never);
  });

  it("OneNote-Events fehlen, bis sie wiederhergestellt werden", async () => {
    const before = (await stats()).totalEvents;
    devEventOverrideStore.set(ONENOTE_ID, { _archived: false });
    expect((await stats()).totalEvents).toBe(before + 1);
  });

  it("Archiviertes Event und seine Teilnahmen zählen nicht mit", async () => {
    const before = await stats();
    expect(before.participationByStatus.registered).toBe(1);
    devEventOverrideStore.set("live-1", { _archived: true });
    const after = await stats();
    expect(after.totalEvents).toBe(before.totalEvents - 1);
    expect(after.participationByStatus.registered).toBe(0);
  });
});
