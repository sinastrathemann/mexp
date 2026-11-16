import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hubAuthMiddleware } from "@mexp/auth";
import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";

// Feedback-Runde 4 (Julian): Anmeldung schließt automatisch zur Frist und manuell per Button.
process.env.MEXP_DATA_DIR = mkdtempSync(join(tmpdir(), "mexp-reg-closing-"));
process.env.AUTH_MODE = "hub";
Reflect.deleteProperty(process.env, "DATABASE_URL");

const { mexpUserStore } = await import("../src/routes/_user-resolution.js");
const { eventRoutes, devEventOverrideStore, devCreatedEventsStore } = await import(
  "../src/routes/events.js"
);
const { devFormStore, devAnswerStore, devLiveParticipantsStore } = await import(
  "../src/routes/registration-form.js"
);
const { errorHandler } = await import("../src/error-handler.js");

function app() {
  const a = new Hono();
  a.onError(errorHandler);
  a.use("*", hubAuthMiddleware());
  a.route("/api/events", eventRoutes);
  return a;
}

function asUser(id: string, roles: string[] = ["employee"]) {
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

const EVT = "evt-reg";
const past = new Date(Date.now() - 86_400_000).toISOString();
const future = new Date(Date.now() + 86_400_000).toISOString();

function register(user = "user-1") {
  return app().request(`/api/events/${EVT}/register`, {
    method: "POST",
    headers: asUser(user),
    body: JSON.stringify({ answers: [], personalNote: null }),
  });
}

function setClosed(closed: boolean, headers: Record<string, string>) {
  return app().request(`/api/events/${EVT}/registration-closed`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ closed }),
  });
}

describe("Anmeldung schließen", () => {
  beforeEach(() => {
    mexpUserStore.clear();
    devEventOverrideStore.clear();
    devCreatedEventsStore.clear();
    devFormStore.clear();
    devAnswerStore.clear();
    devLiveParticipantsStore.clear();
  });

  it("Frist schon beim Anlegen gesetzt (nicht im Override): Anmeldung nach Ablauf abgelehnt", async () => {
    devCreatedEventsStore.set(EVT, {
      id: EVT,
      status: "open",
      capacity: null,
      registrationDeadline: past,
    });
    const res = await register();
    expect(res.status).toBe(409);
  });

  it("Frist in der Zukunft: Anmeldung möglich", async () => {
    devCreatedEventsStore.set(EVT, {
      id: EVT,
      status: "open",
      capacity: null,
      registrationDeadline: future,
    });
    expect((await register()).status).toBe(201);
  });

  it("Event-Team schließt manuell und öffnet wieder; GET zeigt registrationClosed", async () => {
    devCreatedEventsStore.set(EVT, { id: EVT, status: "open", capacity: null });
    const team = asUser("eo", ["event_office"]);
    const closed = await setClosed(true, team);
    expect(closed.status).toBe(200);
    expect(
      ((await closed.json()) as { event: { registrationClosed: boolean } }).event
        .registrationClosed,
    ).toBe(true);
    expect((await register()).status).toBe(409);

    const got = await app().request(`/api/events/${EVT}`, { headers: team });
    expect(
      ((await got.json()) as { event: { registrationClosed: boolean } }).event.registrationClosed,
    ).toBe(true);

    expect((await setClosed(false, team)).status).toBe(200);
    expect((await register()).status).toBe(201);
  });

  it("Events ohne Flag gelten als offen, der Datensatz bleibt unberührt", async () => {
    const record = { id: EVT, status: "open", capacity: null };
    devCreatedEventsStore.set(EVT, record);
    const got = await app().request(`/api/events/${EVT}`, { headers: asUser("user-1") });
    expect(
      ((await got.json()) as { event: { registrationClosed: boolean } }).event.registrationClosed,
    ).toBe(false);
    expect(devCreatedEventsStore.get(EVT)).toEqual(record);
    expect(devEventOverrideStore.has(EVT)).toBe(false);
  });

  it("Mitarbeitende dürfen die Anmeldung nicht schließen", async () => {
    devCreatedEventsStore.set(EVT, { id: EVT, status: "open", capacity: null });
    expect((await setClosed(true, asUser("user-1"))).status).toBe(403);
  });
});
