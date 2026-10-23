import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hubAuthMiddleware } from "@mexp/auth";
import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";

process.env.MEXP_DATA_DIR = mkdtempSync(join(tmpdir(), "mexp-blueprint-tasks-routes-"));
process.env.AUTH_MODE = "hub";

const { mexpUserStore } = await import("../src/routes/_user-resolution.js");
const { blueprintTaskStore } = await import("../src/project-plan/model.js");
const { createBlueprintTaskRoutes } = await import("../src/routes/blueprint-tasks.js");

function app() {
  const a = new Hono();
  a.use("*", hubAuthMiddleware());
  a.route(
    "/api/blueprints",
    createBlueprintTaskRoutes(async (id) => id === "bp1"),
  );
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

const tasks = [
  {
    title: "Coworking buchen",
    daysBefore: 30,
    linkLabel: "Coworking-Copilot",
    linkUrl: "https://personal-hub.mindsquare.de/coworking-copilot/",
  },
  { title: "Einladung verschicken", daysBefore: null, linkLabel: null, linkUrl: null },
];

describe("Blueprint-Aufgaben-API", () => {
  beforeEach(() => {
    mexpUserStore.clear();
    blueprintTaskStore.clear();
  });

  it("Werkstudent speichert und liest die Liste", async () => {
    const ws = asUser("ws", ["werkstudent"]);
    const put = await app().request("/api/blueprints/bp1/tasks", {
      method: "PUT",
      headers: ws,
      body: JSON.stringify({ tasks }),
    });
    expect(put.status).toBe(200);
    const get = await app().request("/api/blueprints/bp1/tasks", { headers: ws });
    const body = (await get.json()) as { tasks: { id: string; title: string }[] };
    expect(body.tasks.map((t) => t.title)).toEqual(["Coworking buchen", "Einladung verschicken"]);
    expect(body.tasks[0]?.id).toBeTruthy();
  });

  it("404 für unbekannten Blueprint", async () => {
    const res = await app().request("/api/blueprints/bp-x/tasks", {
      headers: asUser("ws", ["werkstudent"]),
    });
    expect(res.status).toBe(404);
  });

  it("verweigert Teilnehmenden", async () => {
    const res = await app().request("/api/blueprints/bp1/tasks", {
      headers: asUser("p", ["participant"]),
    });
    expect(res.status).toBe(403);
  });

  it("lehnt daysBefore außerhalb 0–365 ab", async () => {
    const res = await app().request("/api/blueprints/bp1/tasks", {
      method: "PUT",
      headers: asUser("ws", ["werkstudent"]),
      body: JSON.stringify({
        tasks: [{ title: "X", daysBefore: 400, linkLabel: null, linkUrl: null }],
      }),
    });
    expect(res.status).toBe(400);
  });
  const put = (id: string, task: object) =>
    app().request(`/api/blueprints/${id}/tasks`, {
      method: "PUT",
      headers: asUser("ws", ["werkstudent"]),
      body: JSON.stringify({ tasks: [task] }),
    });

  it("PUT auf unbekannten Blueprint gibt 404", async () => {
    const res = await put("bp-x", { title: "X", daysBefore: null, linkLabel: null, linkUrl: null });
    expect(res.status).toBe(404);
  });

  it("lehnt http-Links ab", async () => {
    const res = await put("bp1", {
      title: "X",
      daysBefore: null,
      linkLabel: "A",
      linkUrl: "http://a.de",
    });
    expect(res.status).toBe(400);
  });

  it("lehnt Titel mit 201 Zeichen ab", async () => {
    const res = await put("bp1", {
      title: "x".repeat(201),
      daysBefore: null,
      linkLabel: null,
      linkUrl: null,
    });
    expect(res.status).toBe(400);
  });

  it("lehnt Link-Text ohne URL ab", async () => {
    const res = await put("bp1", {
      title: "X",
      daysBefore: null,
      linkLabel: "Nur Text",
      linkUrl: null,
    });
    expect(res.status).toBe(400);
  });
});
