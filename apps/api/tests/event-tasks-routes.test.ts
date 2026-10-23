import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hubAuthMiddleware } from "@mexp/auth";
import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";

process.env.MEXP_DATA_DIR = mkdtempSync(join(tmpdir(), "mexp-event-tasks-routes-"));
process.env.AUTH_MODE = "hub";

const { mexpUserStore } = await import("../src/routes/_user-resolution.js");
const { eventTaskStore } = await import("../src/project-plan/model.js");
const { eventTaskRoutes } = await import("../src/routes/event-tasks.js");

function app() {
  const a = new Hono();
  a.use("*", hubAuthMiddleware());
  a.route("/api", eventTaskRoutes);
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

const URL_BASE = "/api/events/evt1/tasks";

async function createTask(headers: Record<string, string>, body: object) {
  return app().request(URL_BASE, { method: "POST", headers, body: JSON.stringify(body) });
}

describe("Event-Aufgaben-API", () => {
  beforeEach(() => {
    mexpUserStore.clear();
    eventTaskStore.clear();
  });

  it("Werkstudent legt Aufgabe an und hakt sie ab", async () => {
    const ws = asUser("ws", ["werkstudent"]);
    const created = await createTask(ws, {
      title: "Coworking buchen",
      dueDate: "2027-05-21",
      linkLabel: "Coworking-Copilot",
      linkUrl: "https://personal-hub.mindsquare.de/coworking-copilot/",
    });
    expect(created.status).toBe(201);
    const { task } = (await created.json()) as { task: { id: string; createdBy: string } };
    expect(task.createdBy).toBe("ws");

    const patched = await app().request(`${URL_BASE}/${task.id}`, {
      method: "PATCH",
      headers: ws,
      body: JSON.stringify({ done: true }),
    });
    expect(patched.status).toBe(200);
    const { task: done } = (await patched.json()) as {
      task: { done: boolean; doneBy: string; doneAt: string };
    };
    expect(done).toMatchObject({ done: true, doneBy: "ws" });
    expect(done.doneAt).toBeTruthy();

    const reopened = await app().request(`${URL_BASE}/${task.id}`, {
      method: "PATCH",
      headers: ws,
      body: JSON.stringify({ done: false }),
    });
    expect(((await reopened.json()) as { task: { doneBy: string | null } }).task.doneBy).toBeNull();
  });

  it("verweigert Teilnehmenden den Zugriff", async () => {
    const res = await app().request(URL_BASE, { headers: asUser("p", ["participant"]) });
    expect(res.status).toBe(403);
  });

  it("lehnt Nicht-https-Links und Link ohne Text ab", async () => {
    const ws = asUser("ws", ["werkstudent"]);
    expect(
      (await createTask(ws, { title: "X", linkLabel: "A", linkUrl: "http://a.de" })).status,
    ).toBe(400);
    expect((await createTask(ws, { title: "X", linkUrl: "https://a.de" })).status).toBe(400);
  });

  it("prüft die verantwortliche Person", async () => {
    const eo = asUser("eo", ["event_office"]);
    asUser("p", ["participant"]);
    asUser("ws", ["werkstudent"]);
    expect((await createTask(eo, { title: "X", assigneeId: "p" })).status).toBe(400);
    const ok = await createTask(eo, { title: "X", assigneeId: "ws" });
    expect(((await ok.json()) as { task: { assigneeName: string } }).task.assigneeName).toBe(
      "Name ws",
    );
  });

  it("nur Admins löschen", async () => {
    const eo = asUser("eo", ["event_office"]);
    const { task } = (await (await createTask(eo, { title: "X" })).json()) as {
      task: { id: string };
    };
    expect(
      (await app().request(`${URL_BASE}/${task.id}`, { method: "DELETE", headers: eo })).status,
    ).toBe(403);
    const adm = asUser("adm", ["admin"]);
    expect(
      (await app().request(`${URL_BASE}/${task.id}`, { method: "DELETE", headers: adm })).status,
    ).toBe(200);
    expect(eventTaskStore.get("evt1")).toEqual([]);
  });

  it("PATCH lässt keinen halben Link zurück", async () => {
    const ws = asUser("ws", ["werkstudent"]);
    const { task } = (await (
      await createTask(ws, { title: "X", linkLabel: "Wiki", linkUrl: "https://wiki.mindsquare.de" })
    ).json()) as { task: { id: string } };
    const patch = (body: object) =>
      app().request(`${URL_BASE}/${task.id}`, {
        method: "PATCH",
        headers: ws,
        body: JSON.stringify(body),
      });
    expect((await patch({ linkUrl: null })).status).toBe(400);
    expect((await patch({ linkLabel: null })).status).toBe(400);
    const cleared = await patch({ linkLabel: null, linkUrl: null });
    expect(cleared.status).toBe(200);
    expect(
      ((await cleared.json()) as { task: { linkUrl: string | null } }).task.linkUrl,
    ).toBeNull();
  });

  it("404 für unbekannte Aufgabe", async () => {
    const ws = asUser("ws", ["werkstudent"]);
    const res = await app().request(`${URL_BASE}/nope`, {
      method: "PATCH",
      headers: ws,
      body: JSON.stringify({ done: true }),
    });
    expect(res.status).toBe(404);
  });

  it("listet mögliche Verantwortliche", async () => {
    const ws = asUser("ws", ["werkstudent"]);
    asUser("p", ["participant"]);
    const res = await app().request("/api/events/evt1/task-assignees", { headers: ws });
    const body = (await res.json()) as { assignees: { id: string }[] };
    expect(body.assignees.map((a) => a.id)).toEqual(["ws"]);
  });
});
