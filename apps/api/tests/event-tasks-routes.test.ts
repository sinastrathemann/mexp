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
    const res = await app().request("/api/task-assignees", { headers: ws });
    const body = (await res.json()) as { assignees: { id: string }[] };
    expect(body.assignees.map((a) => a.id)).toEqual(["ws"]);
  });

  it("PATCH: nur Link-Text ändern lässt die URL stehen", async () => {
    const ws = asUser("ws", ["werkstudent"]);
    const { task } = (await (
      await createTask(ws, { title: "X", linkLabel: "Wiki", linkUrl: "https://wiki.mindsquare.de" })
    ).json()) as { task: { id: string } };
    const res = await app().request(`${URL_BASE}/${task.id}`, {
      method: "PATCH",
      headers: ws,
      body: JSON.stringify({ linkLabel: "Neu" }),
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { task: object }).task).toMatchObject({
      linkLabel: "Neu",
      linkUrl: "https://wiki.mindsquare.de",
    });
  });

  it("PATCH: assigneeId null räumt auch den Namen ab", async () => {
    const eo = asUser("eo", ["event_office"]);
    asUser("ws", ["werkstudent"]);
    const { task } = (await (await createTask(eo, { title: "X", assigneeId: "ws" })).json()) as {
      task: { id: string };
    };
    const res = await app().request(`${URL_BASE}/${task.id}`, {
      method: "PATCH",
      headers: eo,
      body: JSON.stringify({ assigneeId: null }),
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { task: object }).task).toMatchObject({
      assigneeId: null,
      assigneeName: null,
    });
  });

  it("PATCH: ungültige assigneeId gibt 400 INVALID_ASSIGNEE", async () => {
    const eo = asUser("eo", ["event_office"]);
    const { task } = (await (await createTask(eo, { title: "X" })).json()) as {
      task: { id: string };
    };
    const res = await app().request(`${URL_BASE}/${task.id}`, {
      method: "PATCH",
      headers: eo,
      body: JSON.stringify({ assigneeId: "gibt-es-nicht" }),
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("INVALID_ASSIGNEE");
  });

  it("PATCH: leeres Update gibt 400", async () => {
    const ws = asUser("ws", ["werkstudent"]);
    const { task } = (await (await createTask(ws, { title: "X" })).json()) as {
      task: { id: string };
    };
    const res = await app().request(`${URL_BASE}/${task.id}`, {
      method: "PATCH",
      headers: ws,
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("begrenzt auf 200 Aufgaben je Event (TOO_MANY_TASKS)", async () => {
    const ws = asUser("ws", ["werkstudent"]);
    const now = new Date().toISOString();
    eventTaskStore.set(
      "evt1",
      Array.from({ length: 200 }, (_, i) => ({
        id: `t${i}`,
        title: `Aufgabe ${i}`,
        dueDate: null,
        assigneeId: null,
        assigneeName: null,
        linkLabel: null,
        linkUrl: null,
        done: false,
        doneBy: null,
        doneAt: null,
        createdBy: "ws",
        createdAt: now,
      })),
    );
    const res = await createTask(ws, { title: "Zu viel" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: { code: "TOO_MANY_TASKS", message: "Maximal 200 Aufgaben je Event." },
    });
    expect(eventTaskStore.get("evt1")).toHaveLength(200);
  });
  it("Priorität: fehlt bei Altbestand → mittel beim Lesen, ohne den Datensatz zu ändern", async () => {
    const ws = asUser("ws", ["werkstudent"]);
    const legacy = {
      id: "alt",
      title: "Altaufgabe",
      dueDate: null,
      assigneeId: null,
      assigneeName: null,
      linkLabel: null,
      linkUrl: null,
      done: false,
      doneBy: null,
      doneAt: null,
      createdBy: "x",
      createdAt: "2026-11-01T00:00:00.000Z",
    };
    eventTaskStore.set("evt1", [legacy]);
    const res = await app().request(URL_BASE, { headers: ws });
    const { tasks } = (await res.json()) as { tasks: { priority: string }[] };
    expect(tasks[0]?.priority).toBe("medium");
    expect(eventTaskStore.get("evt1")?.[0]).toEqual(legacy);
  });

  it("Priorität setzen beim Anlegen und Bearbeiten, ungültige Werte abgelehnt", async () => {
    const ws = asUser("ws", ["werkstudent"]);
    const created = await createTask(ws, { title: "Wichtig", priority: "high" });
    expect(created.status).toBe(201);
    const { task } = (await created.json()) as { task: { id: string; priority: string } };
    expect(task.priority).toBe("high");
    const patched = await app().request(`${URL_BASE}/${task.id}`, {
      method: "PATCH",
      headers: ws,
      body: JSON.stringify({ priority: "low" }),
    });
    expect(((await patched.json()) as { task: { priority: string } }).task.priority).toBe("low");
    const bad = await createTask(ws, { title: "x", priority: "urgent" });
    expect(bad.status).toBe(400);
  });

  it("Reihenfolge speichern: nur vollständige Permutation der vorhandenen Aufgaben", async () => {
    const ws = asUser("ws", ["werkstudent"]);
    const ids: string[] = [];
    for (const title of ["A", "B", "C"]) {
      const r = await createTask(ws, { title });
      ids.push(((await r.json()) as { task: { id: string } }).task.id);
    }
    const [a, b, c] = ids as [string, string, string];
    const ok = await app().request(`${URL_BASE}/order`, {
      method: "PUT",
      headers: ws,
      body: JSON.stringify({ ids: [c, a, b] }),
    });
    expect(ok.status).toBe(200);
    expect(eventTaskStore.get("evt1")?.map((t) => t.title)).toEqual(["C", "A", "B"]);

    const missing = await app().request(`${URL_BASE}/order`, {
      method: "PUT",
      headers: ws,
      body: JSON.stringify({ ids: [a, b] }),
    });
    expect(missing.status).toBe(400);
    const dup = await app().request(`${URL_BASE}/order`, {
      method: "PUT",
      headers: ws,
      body: JSON.stringify({ ids: [a, a, b] }),
    });
    expect(dup.status).toBe(400);
    expect(eventTaskStore.get("evt1")?.map((t) => t.title)).toEqual(["C", "A", "B"]);
  });

  it("Mitarbeitende dürfen die Reihenfolge nicht ändern", async () => {
    const emp = asUser("emp", ["employee"]);
    const res = await app().request(`${URL_BASE}/order`, {
      method: "PUT",
      headers: emp,
      body: JSON.stringify({ ids: [] }),
    });
    expect(res.status).toBe(403);
  });
  describe("ab-Datum (startDate, Runde 6)", () => {
    async function patch(headers: Record<string, string>, id: string, body: object) {
      return app().request(`${URL_BASE}/${id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(body),
      });
    }

    it("legt Aufgabe mit ab-Datum an", async () => {
      const ws = asUser("ws", ["werkstudent"]);
      const res = await createTask(ws, {
        title: "Raum buchen",
        startDate: "2027-02-01",
        dueDate: "2027-03-01",
      });
      expect(res.status).toBe(201);
      const { task } = (await res.json()) as { task: { startDate: string | null } };
      expect(task.startDate).toBe("2027-02-01");
    });

    it("ab nach bis wird abgelehnt (POST und PATCH)", async () => {
      const ws = asUser("ws", ["werkstudent"]);
      const bad = await createTask(ws, {
        title: "Raum buchen",
        startDate: "2027-03-02",
        dueDate: "2027-03-01",
      });
      expect(bad.status).toBe(400);
      expect(((await bad.json()) as { error: { code: string } }).error.code).toBe(
        "INVALID_DATE_RANGE",
      );
      const ok = await createTask(ws, { title: "Raum buchen", dueDate: "2027-03-01" });
      const { task } = (await ok.json()) as { task: { id: string } };
      const res = await patch(ws, task.id, { startDate: "2027-03-05" });
      expect(res.status).toBe(400);
    });

    it("PATCH startDate null löscht, fehlendes Feld lässt unverändert", async () => {
      const ws = asUser("ws", ["werkstudent"]);
      const created = await createTask(ws, { title: "Raum buchen", startDate: "2027-02-01" });
      const { task } = (await created.json()) as { task: { id: string } };
      const keep = await patch(ws, task.id, { title: "Raum buchen (Büro)" });
      expect(((await keep.json()) as { task: { startDate: string | null } }).task.startDate).toBe(
        "2027-02-01",
      );
      const cleared = await patch(ws, task.id, { startDate: null });
      expect(
        ((await cleared.json()) as { task: { startDate: string | null } }).task.startDate,
      ).toBeNull();
    });

    it("Bestandsaufgabe ohne Feld liefert startDate null", async () => {
      const ws = asUser("ws", ["werkstudent"]);
      eventTaskStore.set("evt1", [
        {
          id: "alt",
          title: "Alte Aufgabe",
          dueDate: null,
          assigneeId: null,
          assigneeName: null,
          linkLabel: null,
          linkUrl: null,
          done: false,
          doneBy: null,
          doneAt: null,
          createdBy: "x",
          createdAt: "2026-11-01T00:00:00.000Z",
        },
      ]);
      const res = await app().request(URL_BASE, { headers: ws });
      const { tasks } = (await res.json()) as { tasks: { startDate: string | null }[] };
      expect(tasks[0]?.startDate).toBeNull();
      expect(eventTaskStore.get("evt1")?.[0]).not.toHaveProperty("startDate");
    });
  });
});
