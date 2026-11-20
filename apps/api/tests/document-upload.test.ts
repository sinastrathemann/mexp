import { existsSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hubAuthMiddleware } from "@mexp/auth";
import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";

// Feedback-Runde 6 (Punkt 13): echte Dateien hochladen, öffnen, löschen.
const DATA = mkdtempSync(join(tmpdir(), "mexp-doc-upload-"));
process.env.MEXP_DATA_DIR = DATA;
process.env.AUTH_MODE = "hub";
Reflect.deleteProperty(process.env, "DATABASE_URL");

const { mexpUserStore } = await import("../src/routes/_user-resolution.js");
const { documentRoutes, documentStore, MAX_UPLOAD_BYTES } = await import(
  "../src/routes/documents.js"
);
const { errorHandler } = await import("../src/error-handler.js");

function app() {
  const a = new Hono();
  a.onError(errorHandler);
  a.use("*", hubAuthMiddleware());
  a.route("/api", documentRoutes);
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
  return { "X-MSQ-User-Id": id, "X-MSQ-User-Email": `${id}@mindsquare.de` };
}

function upload(headers: Record<string, string>, file: File, visibility = "event_staff") {
  const body = new FormData();
  body.append("file", file);
  body.append("visibility", visibility);
  return app().request("/api/events/evt1/documents/upload", { method: "POST", headers, body });
}

const pdf = () => new File(["%PDF-1.4 Vertrag"], "Vertrag Hotel.pdf", { type: "application/pdf" });

describe("Dokumente hochladen (Runde 6)", () => {
  beforeEach(() => {
    mexpUserStore.clear();
    documentStore.clear();
  });

  it("Team lädt Datei hoch: Name, Typ, Größe kommen aus der Datei", async () => {
    const res = await upload(asUser("exm", ["event_office"]), pdf(), "event_staff");
    expect(res.status).toBe(201);
    const { document } = (await res.json()) as {
      document: { name: string; mimeType: string; fileSize: number; hasFile: boolean };
    };
    expect(document.name).toBe("Vertrag Hotel.pdf");
    expect(document.mimeType).toBe("application/pdf");
    expect(document.fileSize).toBe(16);
    expect(document.hasFile).toBe(true);
  });

  it("Datei lässt sich öffnen: PDF inline mit Original-Inhalt", async () => {
    const headers = asUser("exm", ["event_office"]);
    const { document } = (await (await upload(headers, pdf())).json()) as {
      document: { id: string };
    };
    const res = await app().request(`/api/documents/${document.id}/file`, { headers });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toMatch(/^inline;/);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await res.text()).toBe("%PDF-1.4 Vertrag");
  });

  it("HTML/SVG werden nie inline ausgeliefert", async () => {
    const headers = asUser("exm", ["event_office"]);
    const html = new File(["<script>x</script>"], "a.html", { type: "text/html" });
    const { document } = (await (await upload(headers, html)).json()) as {
      document: { id: string };
    };
    const res = await app().request(`/api/documents/${document.id}/file`, { headers });
    expect(res.headers.get("content-disposition")).toMatch(/^attachment;/);
    expect(res.headers.get("content-type")).toBe("application/octet-stream");
  });

  it("Mitarbeitende dürfen weder hochladen noch öffnen", async () => {
    const team = asUser("exm", ["event_office"]);
    const { document } = (await (await upload(team, pdf())).json()) as {
      document: { id: string };
    };
    const ma = asUser("ma", ["employee"]);
    expect((await upload(ma, pdf())).status).toBe(403);
    expect(
      (await app().request(`/api/documents/${document.id}/file`, { headers: ma })).status,
    ).toBe(403);
  });

  it("zu große Datei wird abgelehnt", async () => {
    const big = new File([new Uint8Array(MAX_UPLOAD_BYTES + 1)], "gross.pdf", {
      type: "application/pdf",
    });
    const res = await upload(asUser("exm", ["event_office"]), big);
    expect(res.status).toBe(413);
  });

  it("ohne Datei → 400", async () => {
    const body = new FormData();
    body.append("visibility", "event_staff");
    const res = await app().request("/api/events/evt1/documents/upload", {
      method: "POST",
      headers: asUser("exm", ["event_office"]),
      body,
    });
    expect(res.status).toBe(400);
  });

  it("Bestands-Dokument ohne Datei → 404 beim Öffnen", async () => {
    documentStore.set("alt", {
      id: "alt",
      eventId: "evt1",
      name: "alt.pdf",
      mimeType: "application/pdf",
      fileSize: 0,
      storageKey: "events/evt1/x",
      visibility: "event_staff",
      uploadedBy: "x",
      uploadedAt: new Date(),
    });
    const res = await app().request("/api/documents/alt/file", {
      headers: asUser("exm", ["event_office"]),
    });
    expect(res.status).toBe(404);
  });

  it("Löschen entfernt auch die Datei", async () => {
    const admin = asUser("admin", ["admin"]);
    const { document } = (await (await upload(admin, pdf())).json()) as {
      document: { id: string };
    };
    const dir = join(DATA, "documents");
    expect(readdirSync(dir).length).toBeGreaterThan(0);
    const before = readdirSync(dir).length;
    await app().request(`/api/documents/${document.id}`, { method: "DELETE", headers: admin });
    expect(readdirSync(dir).length).toBe(before - 1);
    expect(existsSync(join(dir, document.id))).toBe(false);
  });
});
