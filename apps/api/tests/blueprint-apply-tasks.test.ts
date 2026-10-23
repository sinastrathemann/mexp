import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hubAuthMiddleware } from "@mexp/auth";
import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";

// Datei-Modus: keine Datenbank, temporäres Datenverzeichnis, Hub-Auth über Header.
process.env.MEXP_DATA_DIR = mkdtempSync(join(tmpdir(), "mexp-blueprint-apply-"));
process.env.AUTH_MODE = "hub";
Reflect.deleteProperty(process.env, "DATABASE_URL");

const { mexpUserStore } = await import("../src/routes/_user-resolution.js");
const { blueprintTaskStore, computeDueDate, eventTaskStore } = await import(
  "../src/project-plan/model.js"
);
const { blueprintRoutes } = await import("../src/routes/blueprints.js");

function app() {
  const a = new Hono();
  a.use("*", hubAuthMiddleware());
  a.route("/api/blueprints", blueprintRoutes);
  return a;
}

function asUser(id: string, roles: string[]) {
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

async function createBlueprint(headers: Record<string, string>): Promise<string> {
  const res = await app().request("/api/blueprints", {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Sommerfest",
      eventType: "feelgood",
      defaultDurationMinutes: 120,
    }),
  });
  expect(res.status).toBe(201);
  return ((await res.json()) as { blueprint: { id: string } }).blueprint.id;
}

describe("Blueprint anwenden und löschen (Aufgaben)", () => {
  beforeEach(() => {
    mexpUserStore.clear();
    blueprintTaskStore.clear();
    eventTaskStore.clear();
  });

  it("kopiert die Vorlagen-Aufgaben beim Anwenden ins neue Event", async () => {
    const ws = asUser("ws", ["werkstudent"]);
    const id = await createBlueprint(ws);
    const put = await app().request(`/api/blueprints/${id}/tasks`, {
      method: "PUT",
      headers: ws,
      body: JSON.stringify({
        tasks: [
          {
            title: "Coworking buchen",
            daysBefore: 30,
            linkLabel: "Coworking-Copilot",
            linkUrl: "https://personal-hub.mindsquare.de/coworking-copilot/",
          },
          { title: "Einladung verschicken", daysBefore: null, linkLabel: null, linkUrl: null },
        ],
      }),
    });
    expect(put.status).toBe(200);

    const startAt = "2099-06-20T16:00:00.000Z";
    const res = await app().request(`/api/blueprints/${id}/apply`, {
      method: "POST",
      headers: ws,
      body: JSON.stringify({ title: "Sommerfest 2099", startAt }),
    });
    expect(res.status).toBe(201);
    const { event } = (await res.json()) as { event: { id: string } };

    const copied = eventTaskStore.get(event.id);
    expect(copied).toHaveLength(2);
    expect(copied?.[0]).toMatchObject({
      title: "Coworking buchen",
      dueDate: computeDueDate(startAt, 30),
      linkUrl: "https://personal-hub.mindsquare.de/coworking-copilot/",
    });
    expect(copied?.[1]).toMatchObject({ title: "Einladung verschicken", dueDate: null });
  });

  it("löscht die Vorlagen-Aufgaben mit dem Blueprint", async () => {
    const admin = asUser("adm", ["admin"]);
    const id = await createBlueprint(admin);
    blueprintTaskStore.set(id, [
      { id: "t1", title: "x", daysBefore: null, linkLabel: null, linkUrl: null },
    ]);
    const res = await app().request(`/api/blueprints/${id}`, { method: "DELETE", headers: admin });
    expect(res.status).toBe(200);
    expect(blueprintTaskStore.has(id)).toBe(false);
  });
});
