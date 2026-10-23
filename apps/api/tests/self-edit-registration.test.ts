import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hubAuthMiddleware } from "@mexp/auth";
import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";

// Datei-Modus: keine Datenbank, temporäres Datenverzeichnis, Hub-Auth über Header.
process.env.MEXP_DATA_DIR = mkdtempSync(join(tmpdir(), "mexp-self-edit-"));
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

function asUser(id = "user-1") {
  const now = new Date().toISOString();
  mexpUserStore.set(id, {
    id,
    email: `${id}@mindsquare.de`,
    displayName: id,
    roles: ["employee"],
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

const EVT = "evt-open";

function register(answers: unknown[], user = "user-1") {
  return app().request(`/api/events/${EVT}/register`, {
    method: "POST",
    headers: asUser(user),
    body: JSON.stringify({ answers, personalNote: null }),
  });
}

function edit(body: unknown, user = "user-1") {
  return app().request(`/api/events/${EVT}/my-registration`, {
    method: "PATCH",
    headers: asUser(user),
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/events/:id/my-registration im Datei-Modus", () => {
  beforeEach(() => {
    mexpUserStore.clear();
    devEventOverrideStore.clear();
    devCreatedEventsStore.clear();
    devFormStore.clear();
    devAnswerStore.clear();
    devLiveParticipantsStore.clear();
    devCreatedEventsStore.set(EVT, { id: EVT, status: "open", capacity: null });
    devFormStore.set(EVT, [
      {
        id: "q1",
        order: 0,
        type: "single_choice",
        label: "Krimi-Dinner?",
        required: true,
        options: ["Ja", "Nein"],
      },
    ]);
  });

  it("ändert Antworten und Notiz der eigenen Anmeldung", async () => {
    expect((await register([{ questionId: "q1", value: "Ja" }])).status).toBe(201);
    const res = await edit({
      answers: [{ questionId: "q1", value: "Nein" }],
      personalNote: "komme später",
    });
    expect(res.status).toBe(200);
    const mine = await app().request(`/api/events/${EVT}/my-participation`, {
      headers: asUser(),
    });
    const body = (await mine.json()) as {
      participation: { status: string; personalNote: string; answers: { value: unknown }[] };
    };
    expect(body.participation.status).toBe("registered");
    expect(body.participation.personalNote).toBe("komme später");
    expect(body.participation.answers[0]?.value).toBe("Nein");
  });

  it("prüft die Antworten wie bei der Anmeldung", async () => {
    await register([{ questionId: "q1", value: "Ja" }]);
    const res = await edit({ answers: [{ questionId: "q1", value: "Vielleicht" }] });
    expect(res.status).toBe(400);
  });

  it("ohne aktive Anmeldung: 404", async () => {
    const res = await edit({ answers: [{ questionId: "q1", value: "Ja" }] });
    expect(res.status).toBe(404);
  });

  it("Anmeldung nicht mehr offen: 409", async () => {
    await register([{ questionId: "q1", value: "Ja" }]);
    devEventOverrideStore.set(EVT, { status: "running" });
    const res = await edit({ answers: [{ questionId: "q1", value: "Nein" }] });
    expect(res.status).toBe(409);
  });

  it("Anmeldefrist abgelaufen: 409", async () => {
    await register([{ questionId: "q1", value: "Ja" }]);
    devEventOverrideStore.set(EVT, { registrationDeadline: "2020-01-01T00:00:00.000Z" });
    const res = await edit({ answers: [{ questionId: "q1", value: "Nein" }] });
    expect(res.status).toBe(409);
  });

  it("Warteliste behält ihren Platz", async () => {
    devCreatedEventsStore.set(EVT, { id: EVT, status: "open", capacity: 1 });
    await register([{ questionId: "q1", value: "Ja" }], "user-1");
    await register([{ questionId: "q1", value: "Ja" }], "user-2");
    const res = await edit({ answers: [{ questionId: "q1", value: "Nein" }] }, "user-2");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      participation: { status: string; waitlistPosition: number };
    };
    expect(body.participation.status).toBe("waitlisted");
    expect(body.participation.waitlistPosition).toBe(1);
  });
});
