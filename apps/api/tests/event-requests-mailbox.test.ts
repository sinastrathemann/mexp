import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hubAuthMiddleware } from "@mexp/auth";
import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";

process.env.MEXP_DATA_DIR = mkdtempSync(join(tmpdir(), "mexp-event-requests-"));
process.env.AUTH_MODE = "hub";
Reflect.deleteProperty(process.env, "DATABASE_URL");

const { mexpUserStore } = await import("../src/routes/_user-resolution.js");
const { eventRequestRoutes, eventRequestStore } = await import("../src/routes/event-requests.js");
const { errorHandler } = await import("../src/error-handler.js");
type EventRequestRecord = import("../src/routes/event-requests.js").EventRequestRecord;

function app() {
  const a = new Hono();
  a.onError(errorHandler);
  a.use("*", hubAuthMiddleware());
  a.route("/api/event-requests", eventRequestRoutes);
  return a;
}

function user(id: string, roles: string[]) {
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

// Altbestand-Format: KEIN archivedAt-Feld (wie die Live-Daten)
function seed(id: string, patch: Partial<EventRequestRecord> = {}) {
  const now = "2026-11-01T10:00:00.000Z";
  const record = {
    id,
    requesterId: "vanessa",
    requesterName: "Vanessa",
    requesterEmail: "vanessa@mindsquare.de",
    category: "team",
    categoryDetails: "",
    participantCount: 10,
    participantList: "",
    partnersInvited: false,
    dateFixed: false,
    fixedDate: null,
    hasCalendarBlocker: false,
    proposedDates: "irgendwann",
    wholeWeekend: false,
    occasion: id,
    contactIsRequester: true,
    contactName: null,
    destination: "",
    activity: "",
    suggestionsWanted: false,
    coworking: false,
    notes: "",
    status: "submitted",
    assignedToId: null,
    assignedToName: null,
    eventId: null,
    createdAt: now,
    updatedAt: now,
    ...patch,
  } as EventRequestRecord;
  eventRequestStore.set(id, record);
}

async function list(headers: Record<string, string>, query: string) {
  const res = await app().request(`/api/event-requests${query}`, { headers });
  return {
    status: res.status,
    ids: res.ok
      ? ((await res.json()) as { requests: { id: string }[] }).requests.map((r) => r.id)
      : [],
  };
}

async function ping(headers: Record<string, string>) {
  const res = await app().request("/api/event-requests/pending-count", { headers });
  return (await res.json()) as { submitted: number; assignedToMe: number };
}

function patch(headers: Record<string, string>, id: string, body: unknown) {
  return app().request(`/api/event-requests/${id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  });
}

describe("Eventanfragen: Postfächer und Archiv", () => {
  let admin: Record<string, string>;
  let saskia: Record<string, string>;
  let werk2: Record<string, string>;

  beforeEach(() => {
    mexpUserStore.clear();
    eventRequestStore.clear();
    admin = user("admin-1", ["admin"]);
    saskia = user("saskia", ["werkstudent"]);
    werk2 = user("werk-2", ["werkstudent"]);
    user("vanessa", ["participant"]);
    seed("neu");
    seed("ypp", { status: "in_review", assignedToId: "saskia", assignedToName: "Saskia" });
  });

  it("Anfrage ohne archivedAt erscheint im Eingang und zählt im Ping (Live-Daten)", async () => {
    expect((await list(admin, "?view=inbox")).ids).toEqual(["neu"]);
    expect((await ping(admin)).submitted).toBe(1);
  });

  it("Zugewiesene Anfrage ohne archivedAt/eventId liegt im Postfach (Schutz YPP Revival)", async () => {
    expect((await list(saskia, "?view=assigned")).ids).toEqual(["ypp"]);
    expect((await ping(saskia)).assignedToMe).toBe(1);
    expect((await list(admin, "?view=assigned&assignee=saskia")).ids).toEqual(["ypp"]);
  });

  it("Archivierte Anfrage fehlt im Eingang/Ping, steht im Archiv, bleibt für Antragstellende sichtbar", async () => {
    expect((await patch(admin, "neu", { archived: true })).status).toBe(200);
    expect((await patch(admin, "neu", { archived: true })).status).toBe(200); // idempotent
    expect((await list(admin, "?view=inbox")).ids).toEqual([]);
    expect((await ping(admin)).submitted).toBe(0);
    expect((await list(admin, "?view=archive")).ids).toEqual(["neu"]);
    const vanessa = user("vanessa", ["participant"]);
    expect((await list(vanessa, "?mine=true")).ids).toContain("neu");

    expect((await patch(admin, "neu", { archived: false })).status).toBe(200);
    expect((await list(admin, "?view=inbox")).ids).toEqual(["neu"]);
  });

  it("Event anlegen archiviert die Anfrage", async () => {
    expect((await patch(saskia, "ypp", { eventId: "evt-neu" })).status).toBe(200);
    expect((await list(saskia, "?view=assigned")).ids).toEqual([]);
    expect((await ping(saskia)).assignedToMe).toBe(0);
    expect((await list(admin, "?view=archive")).ids).toEqual(["ypp"]);
    expect(eventRequestStore.get("ypp")?.eventId).toBe("evt-neu");
  });

  it("Werkstudent darf nicht archivieren und nicht weiterleiten", async () => {
    expect((await patch(saskia, "ypp", { archived: true })).status).toBe(403);
    expect((await patch(saskia, "ypp", { assignedToId: "werk-2" })).status).toBe(403);
    const vanessa = user("vanessa", ["participant"]);
    expect((await patch(vanessa, "neu", { archived: true })).status).toBe(403);
  });

  it("Werkstudent sieht nur eigene/zugewiesene Anfragen", async () => {
    expect((await list(werk2, "")).ids).toEqual([]);
    expect((await list(werk2, "?view=inbox")).status).toBe(403);
    expect((await list(werk2, "?view=archive")).status).toBe(403);
    expect((await list(werk2, "?view=assigned&assignee=saskia")).status).toBe(403);
    const res = await app().request("/api/event-requests/ypp", { headers: werk2 });
    expect(res.status).toBe(403);
    expect((await patch(werk2, "ypp", { status: "approved" })).status).toBe(403);
    const own = await app().request("/api/event-requests/ypp", { headers: saskia });
    expect(own.status).toBe(200);
  });

  it("Weiterleiten verschiebt aus dem Eingang ins Postfach", async () => {
    expect((await patch(admin, "neu", { assignedToId: "werk-2" })).status).toBe(200);
    expect((await list(admin, "?view=inbox")).ids).toEqual([]);
    expect((await list(werk2, "?view=assigned")).ids).toEqual(["neu"]);
  });

  it("Unbekannte ID: 404", async () => {
    expect((await patch(admin, "gibt-es-nicht", { archived: true })).status).toBe(404);
  });
});
