import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hubAuthMiddleware } from "@mexp/auth";
import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";

process.env.MEXP_DATA_DIR = mkdtempSync(join(tmpdir(), "mexp-tools-routes-"));
process.env.AUTH_MODE = "hub";

const { mexpUserStore } = await import("../src/routes/_user-resolution.js");
const { toolStore } = await import("../src/project-plan/model.js");
const { toolRoutes } = await import("../src/routes/tools.js");

function app() {
  const a = new Hono();
  a.use("*", hubAuthMiddleware());
  a.route("/api/tools", toolRoutes);
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

describe("Tools-API", () => {
  beforeEach(() => {
    mexpUserStore.clear();
    toolStore.clear();
  });

  it("liefert Werkstudenten die Vorbelegung", async () => {
    const res = await app().request("/api/tools", { headers: asUser("ws", ["werkstudent"]) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { tools: { label: string }[] };
    expect(body.tools.map((t) => t.label)).toContain("Coworking-Copilot");
  });

  it("verweigert Teilnehmenden das Lesen", async () => {
    const res = await app().request("/api/tools", { headers: asUser("p", ["participant"]) });
    expect(res.status).toBe(403);
  });

  it("lässt nur Admins speichern", async () => {
    const body = JSON.stringify({ tools: [{ label: "Wiki", url: "https://wiki.mindsquare.de" }] });
    const denied = await app().request("/api/tools", {
      method: "PUT",
      body,
      headers: asUser("eo", ["event_office"]),
    });
    expect(denied.status).toBe(403);
    const ok = await app().request("/api/tools", {
      method: "PUT",
      body,
      headers: asUser("adm", ["admin"]),
    });
    expect(ok.status).toBe(200);
    const saved = (await ok.json()) as { tools: { id: string; label: string }[] };
    expect(saved.tools).toHaveLength(1);
    expect(saved.tools[0]?.id).toBeTruthy();
    expect(toolStore.get("default")?.updatedBy).toBe("adm");
  });

  it("lehnt http-Links ab", async () => {
    const body = JSON.stringify({ tools: [{ label: "Alt", url: "http://example.com" }] });
    const res = await app().request("/api/tools", {
      method: "PUT",
      body,
      headers: asUser("adm", ["admin"]),
    });
    expect(res.status).toBe(400);
  });
  const put = (body: unknown) =>
    app().request("/api/tools", {
      method: "PUT",
      body: JSON.stringify(body),
      headers: asUser("adm", ["admin"]),
    });

  it("lehnt doppelte IDs ab", async () => {
    const res = await put({
      tools: [
        { id: "a", label: "Eins", url: "https://a.de" },
        { id: "a", label: "Zwei", url: "https://b.de" },
      ],
    });
    expect(res.status).toBe(400);
  });

  it("PUT und danach GET liefern genau die gespeicherte Liste", async () => {
    const tools = [
      { id: "a", label: "Eins", url: "https://a.de" },
      { id: "b", label: "Zwei", url: "https://b.de" },
    ];
    expect((await put({ tools })).status).toBe(200);
    const get = await app().request("/api/tools", { headers: asUser("ws", ["werkstudent"]) });
    expect(((await get.json()) as { tools: unknown[] }).tools).toEqual(tools);
  });

  it("lehnt zu lange Labels und URLs ab", async () => {
    expect((await put({ tools: [{ label: "x".repeat(101), url: "https://a.de" }] })).status).toBe(
      400,
    );
    expect(
      (await put({ tools: [{ label: "Ok", url: `https://a.de/${"x".repeat(1995)}` }] })).status,
    ).toBe(400);
  });

  it("lehnt javascript:-Links ab", async () => {
    expect((await put({ tools: [{ label: "XSS", url: "javascript:alert(1)" }] })).status).toBe(400);
  });

  it("manager und event_office dürfen lesen", async () => {
    for (const role of ["manager", "event_office"]) {
      const res = await app().request("/api/tools", { headers: asUser(role, [role]) });
      expect(res.status).toBe(200);
    }
  });

  it("leere Liste bleibt leer (keine Rückkehr zur Vorbelegung)", async () => {
    expect((await put({ tools: [] })).status).toBe(200);
    const get = await app().request("/api/tools", { headers: asUser("ws", ["werkstudent"]) });
    expect(((await get.json()) as { tools: unknown[] }).tools).toEqual([]);
  });
});
