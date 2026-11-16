import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hubAuthMiddleware } from "@mexp/auth";
import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";

process.env.MEXP_DATA_DIR = mkdtempSync(join(tmpdir(), "mexp-event-plan-meta-"));
process.env.AUTH_MODE = "hub";

const { mexpUserStore } = await import("../src/routes/_user-resolution.js");
const { eventPlanMetaStore } = await import("../src/project-plan/model.js");
const { eventPlanMetaRoutes } = await import("../src/routes/event-plan-meta.js");

function app() {
  const a = new Hono();
  a.use("*", hubAuthMiddleware());
  a.route("/api", eventPlanMetaRoutes);
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

const URL = "/api/events/evt1/plan-meta";

function put(headers: Record<string, string>, body: object) {
  return app().request(URL, { method: "PUT", headers, body: JSON.stringify(body) });
}

describe("Projektplan-Meta (Verantwortlich + EXM-Notiz)", () => {
  beforeEach(() => {
    mexpUserStore.clear();
    eventPlanMetaStore.clear();
  });

  it("liefert leere Werte für Events ohne Eintrag (Live-Events bleiben unverändert)", async () => {
    const ws = asUser("ws", ["werkstudent"]);
    const res = await app().request(URL, { headers: ws });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      meta: { responsibleId: null, responsibleName: null, exmNote: null },
    });
    expect(eventPlanMetaStore.size).toBe(0);
  });

  it("setzt Verantwortliche/n und EXM-Notiz und liest sie wieder", async () => {
    const ws = asUser("ws", ["werkstudent"]);
    asUser("eo", ["event_office"]);
    const res = await put(ws, { responsibleId: "eo", exmNote: "Nur intern: Budget knapp" });
    expect(res.status).toBe(200);
    const got = await app().request(URL, { headers: ws });
    expect(((await got.json()) as { meta: unknown }).meta).toMatchObject({
      responsibleId: "eo",
      responsibleName: "Name eo",
      exmNote: "Nur intern: Budget knapp",
    });
  });

  it("Teilupdate lässt das andere Feld stehen, null leert", async () => {
    const ws = asUser("ws", ["werkstudent"]);
    asUser("eo", ["event_office"]);
    await put(ws, { responsibleId: "eo", exmNote: "Notiz" });
    await put(ws, { exmNote: null });
    const got = await app().request(URL, { headers: ws });
    expect(((await got.json()) as { meta: unknown }).meta).toMatchObject({
      responsibleId: "eo",
      exmNote: null,
    });
  });

  it("lehnt Verantwortliche außerhalb des Event-Teams ab", async () => {
    const ws = asUser("ws", ["werkstudent"]);
    asUser("emp", ["employee"]);
    const res = await put(ws, { responsibleId: "emp" });
    expect(res.status).toBe(400);
  });

  it("Mitarbeitende ohne Event-Team-Rolle sehen die EXM-Notiz nicht", async () => {
    const ws = asUser("ws", ["werkstudent"]);
    await put(ws, { exmNote: "geheim" });
    const emp = asUser("emp", ["employee"]);
    const res = await app().request(URL, { headers: emp });
    expect(res.status).toBe(403);
    const write = await put(emp, { exmNote: "x" });
    expect(write.status).toBe(403);
  });
});
