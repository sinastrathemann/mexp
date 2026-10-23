import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hubAuthMiddleware } from "@mexp/auth";
import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";

// Datei-Modus: keine Datenbank, temporäres Datenverzeichnis, Hub-Auth über Header.
process.env.MEXP_DATA_DIR = mkdtempSync(join(tmpdir(), "mexp-event-status-"));
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

function patchStatus(id: string, status: string) {
  return app().request(`/api/events/${id}/status`, {
    method: "PATCH",
    headers: asAdmin(),
    body: JSON.stringify({ status }),
  });
}

describe("PATCH /api/events/:id/status im Datei-Modus", () => {
  beforeEach(() => {
    mexpUserStore.clear();
    devEventOverrideStore.clear();
    devCreatedEventsStore.clear();
  });

  it("unbekannte ID: 404 und kein Override-Eintrag", async () => {
    const res = await patchStatus("gibt-es-nicht", "planned");
    expect(res.status).toBe(404);
    expect(devEventOverrideStore.has("gibt-es-nicht")).toBe(false);
  });

  it("unerlaubter Wechsel: 409 wie im DB-Modus, Status bleibt", async () => {
    devCreatedEventsStore.set("evt-closed", { id: "evt-closed", status: "closed" });
    const res = await patchStatus("evt-closed", "draft");
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("EVENT_STATUS_TRANSITION_INVALID");
    expect(devEventOverrideStore.has("evt-closed")).toBe(false);
  });

  it("erlaubter Wechsel (Reaktivieren) wird gespeichert", async () => {
    devCreatedEventsStore.set("evt-cancelled", { id: "evt-cancelled", status: "cancelled" });
    const res = await patchStatus("evt-cancelled", "draft");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { event: { status: string } };
    expect(body.event.status).toBe("draft");
  });
});
