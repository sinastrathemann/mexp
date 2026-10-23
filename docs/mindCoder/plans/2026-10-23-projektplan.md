# Projektplan-Ansicht – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use mindCoder:subagent-driven-development (recommended) or mindCoder:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Event-Detailseite wird für das interne Team zum Projektplan: Phasen-Leiste, Aufgaben-Checkliste (aus Blueprints vorbefüllt), zentrale Tools-Links und Budget-Link statt Budget-Bereich.

**Architecture:** Neue Datei-basierte Stores (`persistentMap`) für Event-Aufgaben, Blueprint-Aufgaben und Tools. Sie liegen gebündelt in `apps/api/src/project-plan/model.ts`, zusammen mit reinen Hilfsfunktionen. Hono-Routen in eigenen Modulen. Die Blueprint-Aufgaben-Routen bekommen die Blueprint-Existenzprüfung injiziert, damit sie ohne `deps.ts` testbar sind. Im Frontend gibt es neue, fokussierte Komponenten unter `apps/web/src/events/`. Die Logik (Sortierung, Fortschritt, Überfälligkeit) liegt in `task-utils.ts` und ist als reine Funktionen getestet.

**Tech Stack:** Hono + Zod + `@hono/zod-validator` (API), React + TanStack Query + react-i18next (Web), Vitest, Biome, pnpm.

**Spec:** `docs/mindCoder/specs/2026-10-23-projektplan-design.md`

## Global Constraints

- Rollen „Team“ = `admin, manager, event_office, werkstudent`. Aufgaben löschen und Tools pflegen darf nur `admin`.
- Links: nur `https://`, URL max. 2000 Zeichen, Linktext max. 100 Zeichen. Aufgabentitel 1–200 Zeichen. `daysBefore` ganze Zahl 0–365 oder `null`.
- Externe Links immer mit `target="_blank" rel="noopener noreferrer"`.
- Vorbelegte Tools: „Coworking-Copilot“ `https://personal-hub.mindsquare.de/coworking-copilot/`, „Budget-Control-Agent“ `https://personal-hub.mindsquare.de/budget-control-agent/`.
- Die Budget-Kasten-URL ist eine feste Konstante, unabhängig von der Tools-Liste.
- Kein Audit-Log. Stattdessen Akteur- und Zeitstempel-Felder.
- Alle UI-Texte über i18n in `apps/web/src/locales/de.json` **und** `en.json`.
- Code-Kommentare auf Deutsch, Bezeichner auf Englisch (wie im Repo).
- Vor jedem Commit: `npx biome format --write <geänderte Dateien>` (CRLF-Rauschen, siehe Repo-Erfahrung). Tests mit `pnpm test`, Typen mit `pnpm typecheck`.
- API-Tests setzen `process.env.MEXP_DATA_DIR` auf ein Temp-Verzeichnis und `AUTH_MODE=hub` **vor** dem dynamischen Import der Module (Muster: `apps/api/tests/require-mexp-role.test.ts`).

---

## File Structure

| Datei | Verantwortung |
|---|---|
| `apps/web/src/pages/blueprints.tsx` (mod) | Werkstudent darf schreiben, Button „Aufgaben“ öffnet den Editor |
| `apps/api/src/project-plan/model.ts` (neu) | Typen, Stores, Zod-Schemas für Links, `DEFAULT_TOOLS`, `computeDueDate`, `copyBlueprintTasksToEvent` |
| `apps/api/src/routes/tools.ts` (neu) | `GET/PUT /api/tools` |
| `apps/api/src/routes/event-tasks.ts` (neu) | `GET/POST/PATCH/DELETE /api/events/:eventId/tasks` |
| `apps/api/src/routes/blueprint-tasks.ts` (neu) | `createBlueprintTaskRoutes(blueprintExists)`: `GET/PUT /:id/tasks` |
| `apps/api/src/routes/blueprints.ts` (mod) | mountet die Blueprint-Aufgaben, kopiert Aufgaben in `/:id/apply` |
| `apps/api/src/index.ts` (mod) | mountet Tools- und Event-Aufgaben-Routen |
| `apps/web/src/events/project-plan-types.ts` (neu) | DTOs `EventTaskDto`, `BlueprintTaskDto`, `ToolLinkDto` |
| `apps/web/src/events/task-utils.ts` (neu) | `sortTasks`, `taskProgress`, `isOverdue` |
| `apps/web/src/events/external-links.ts` (neu) | `BUDGET_TOOL_URL` |
| `apps/web/src/events/tools-card.tsx` (neu) | Tools-Kasten |
| `apps/web/src/events/budget-link-card.tsx` (neu) | ersetzt `BudgetPanel` |
| `apps/web/src/events/key-figures-card.tsx` (neu) | Anmeldungen / Kapazität |
| `apps/web/src/events/phase-bar.tsx` (neu) | Phasen-Leiste + Absage-Button |
| `apps/web/src/events/task-checklist.tsx` (neu) | Checkliste inkl. Anlegen/Bearbeiten |
| `apps/web/src/admin/tools-panel.tsx` (neu) | Admin-Reiter „Tools“ |
| `apps/web/src/admin/blueprint-tasks-modal.tsx` (neu) | Aufgaben-Editor für einen Blueprint |
| `apps/web/src/pages/event-detail.tsx` (mod) | neues Layout |
| `apps/web/src/pages/admin.tsx` (mod) | Reiter „Tools“ |
| `apps/web/src/styles/*.css` (mod) | Styles für Phasen-Leiste und Zwei-Spalten-Raster |

---

### Task 1: Werkstudenten dürfen Blueprints bearbeiten (Oberfläche)

**Files:**
- Modify: `apps/web/src/pages/blueprints.tsx:43`

- [ ] **Step 1: canWrite anpassen**

```tsx
  // Werkstudent:innen pflegen Vorlagen (Rollen-Legende, admin.tsx) — API erlaubt es bereits.
  const canWrite = hasRole("admin", "manager", "event_office", "werkstudent");
```

- [ ] **Step 2: Typcheck**

Run: `pnpm --filter @mexp/web typecheck`
Expected: keine Fehler

- [ ] **Step 3: Commit**

```bash
npx biome format --write apps/web/src/pages/blueprints.tsx
git add apps/web/src/pages/blueprints.tsx
git commit -m "fix(blueprints): let werkstudent edit templates like the API and role legend allow"
```

---

### Task 2: Projektplan-Modell (Typen, Stores, Hilfsfunktionen)

**Files:**
- Create: `apps/api/src/project-plan/model.ts`
- Test: `apps/api/tests/project-plan-model.test.ts`

**Interfaces:**
- Produces:
  - `TEAM_ROLES`, `type EventTask`, `type BlueprintTask`, `type ToolLink`, `type ToolList`
  - `eventTaskStore: Map<string, EventTask[]>` (Schlüssel eventId), `blueprintTaskStore: Map<string, BlueprintTask[]>` (Schlüssel blueprintId), `toolStore: Map<string, ToolList>` (Schlüssel `"default"`)
  - `linkLabelSchema`, `httpsUrlSchema` (Zod)
  - `DEFAULT_TOOLS: ToolLink[]`, `getTools(): ToolLink[]`
  - `computeDueDate(startAtIso: string, daysBefore: number | null): string | null` → `YYYY-MM-DD`
  - `copyBlueprintTasksToEvent(blueprintId: string, eventId: string, eventStartAtIso: string, actorId: string): EventTask[]`

- [ ] **Step 1: Failing Test schreiben**

```ts
// apps/api/tests/project-plan-model.test.ts
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

// Vor dem Import setzen — dev-persistence liest MEXP_DATA_DIR beim Modul-Laden.
process.env.MEXP_DATA_DIR = mkdtempSync(join(tmpdir(), "mexp-project-plan-model-"));

const {
  DEFAULT_TOOLS,
  blueprintTaskStore,
  computeDueDate,
  copyBlueprintTasksToEvent,
  eventTaskStore,
  getTools,
  httpsUrlSchema,
  toolStore,
} = await import("../src/project-plan/model.js");

describe("computeDueDate", () => {
  it("zieht die Tage vom Event-Start ab und liefert ein Datum ohne Uhrzeit", () => {
    expect(computeDueDate("2027-06-20T16:00:00.000Z", 14)).toBe("2027-06-06");
  });
  it("liefert den Event-Tag bei 0 Tagen", () => {
    expect(computeDueDate("2027-06-20T16:00:00.000Z", 0)).toBe("2027-06-20");
  });
  it("liefert null ohne Tageswert", () => {
    expect(computeDueDate("2027-06-20T16:00:00.000Z", null)).toBeNull();
  });
});

describe("httpsUrlSchema", () => {
  it("akzeptiert https", () => {
    expect(httpsUrlSchema.safeParse("https://personal-hub.mindsquare.de/x/").success).toBe(true);
  });
  it("lehnt http und javascript: ab", () => {
    expect(httpsUrlSchema.safeParse("http://example.com").success).toBe(false);
    expect(httpsUrlSchema.safeParse("javascript:alert(1)").success).toBe(false);
  });
});

describe("getTools", () => {
  beforeEach(() => toolStore.clear());
  it("liefert die Vorbelegung, solange nie gespeichert wurde", () => {
    expect(getTools()).toEqual(DEFAULT_TOOLS);
    expect(DEFAULT_TOOLS.map((t) => t.label)).toEqual(["Coworking-Copilot", "Budget-Control-Agent"]);
  });
  it("liefert eine gespeicherte (auch leere) Liste", () => {
    toolStore.set("default", { tools: [], updatedBy: "u1", updatedAt: "2026-10-23T00:00:00.000Z" });
    expect(getTools()).toEqual([]);
  });
});

describe("copyBlueprintTasksToEvent", () => {
  beforeEach(() => {
    blueprintTaskStore.clear();
    eventTaskStore.clear();
  });
  it("kopiert Aufgaben mit berechneter Fälligkeit und hängt an bestehende an", () => {
    blueprintTaskStore.set("bp1", [
      { id: "b1", title: "Coworking buchen", daysBefore: 30, linkLabel: "Coworking-Copilot", linkUrl: "https://personal-hub.mindsquare.de/coworking-copilot/" },
      { id: "b2", title: "Einladung verschicken", daysBefore: null, linkLabel: null, linkUrl: null },
    ]);
    const copied = copyBlueprintTasksToEvent("bp1", "evt1", "2027-06-20T16:00:00.000Z", "u1");
    expect(copied).toHaveLength(2);
    expect(copied[0]).toMatchObject({ title: "Coworking buchen", dueDate: "2027-05-21", done: false, createdBy: "u1", linkUrl: "https://personal-hub.mindsquare.de/coworking-copilot/" });
    expect(copied[1]).toMatchObject({ title: "Einladung verschicken", dueDate: null });
    expect(copied[0]?.id).not.toBe("b1");
    expect(eventTaskStore.get("evt1")).toHaveLength(2);
  });
  it("macht nichts ohne Blueprint-Aufgaben", () => {
    expect(copyBlueprintTasksToEvent("bp-x", "evt1", "2027-06-20T16:00:00.000Z", "u1")).toEqual([]);
    expect(eventTaskStore.has("evt1")).toBe(false);
  });
});
```

- [ ] **Step 2: Test laufen lassen, er muss fehlschlagen**

Run: `pnpm vitest run apps/api/tests/project-plan-model.test.ts`
Expected: FAIL – Modul `../src/project-plan/model.js` nicht gefunden

- [ ] **Step 3: Implementierung**

```ts
// apps/api/src/project-plan/model.ts
/**
 * Projektplan je Event (Spec docs/mindCoder/specs/2026-10-23-projektplan-design.md):
 * Aufgaben pro Event, Aufgaben-Vorlagen pro Blueprint und die zentrale Tools-Liste.
 * Datei-basiert wie Event-Anfragen (persistentMap) — kein Audit-Log, daher tragen
 * die Datensätze selbst, wer was wann angelegt bzw. abgehakt hat.
 */
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { persistentMap } from "../dev-persistence.js";

export const TEAM_ROLES = ["admin", "manager", "event_office", "werkstudent"] as const;

export interface EventTask {
  id: string;
  title: string;
  dueDate: string | null; // YYYY-MM-DD
  assigneeId: string | null;
  assigneeName: string | null;
  linkLabel: string | null;
  linkUrl: string | null;
  done: boolean;
  doneBy: string | null;
  doneAt: string | null;
  createdBy: string;
  createdAt: string;
}

export interface BlueprintTask {
  id: string;
  title: string;
  daysBefore: number | null;
  linkLabel: string | null;
  linkUrl: string | null;
}

export interface ToolLink {
  id: string;
  label: string;
  url: string;
}

export interface ToolList {
  tools: ToolLink[];
  updatedBy: string;
  updatedAt: string;
}

export const eventTaskStore = persistentMap<EventTask[]>("event-tasks");
export const blueprintTaskStore = persistentMap<BlueprintTask[]>("blueprint-tasks");
export const toolStore = persistentMap<ToolList>("tools");

// Nur https: verhindert javascript:-Links und unverschlüsselte Ziele.
export const httpsUrlSchema = z
  .string()
  .trim()
  .max(2000)
  .url()
  .refine((u) => u.startsWith("https://"), { message: "Nur https-Links erlaubt." });
export const linkLabelSchema = z.string().trim().min(1).max(100);
export const taskTitleSchema = z.string().trim().min(1).max(200);

export const DEFAULT_TOOLS: ToolLink[] = [
  {
    id: "coworking-copilot",
    label: "Coworking-Copilot",
    url: "https://personal-hub.mindsquare.de/coworking-copilot/",
  },
  {
    id: "budget-control-agent",
    label: "Budget-Control-Agent",
    url: "https://personal-hub.mindsquare.de/budget-control-agent/",
  },
];

/** Gespeicherte Liste — oder die Vorbelegung, solange der Admin nie gespeichert hat. */
export function getTools(): ToolLink[] {
  return toolStore.get("default")?.tools ?? DEFAULT_TOOLS;
}

/** Fälligkeit = Event-Start minus N Tage, als Kalenderdatum (UTC). */
export function computeDueDate(startAtIso: string, daysBefore: number | null): string | null {
  if (daysBefore === null) return null;
  const due = new Date(new Date(startAtIso).getTime() - daysBefore * 86_400_000);
  return due.toISOString().slice(0, 10);
}

/** Kopiert die Aufgaben eines Blueprints in ein neu angelegtes Event. */
export function copyBlueprintTasksToEvent(
  blueprintId: string,
  eventId: string,
  eventStartAtIso: string,
  actorId: string,
): EventTask[] {
  const templates = blueprintTaskStore.get(blueprintId) ?? [];
  if (templates.length === 0) return [];
  const now = new Date().toISOString();
  const copied: EventTask[] = templates.map((t) => ({
    id: randomUUID(),
    title: t.title,
    dueDate: computeDueDate(eventStartAtIso, t.daysBefore),
    assigneeId: null,
    assigneeName: null,
    linkLabel: t.linkLabel,
    linkUrl: t.linkUrl,
    done: false,
    doneBy: null,
    doneAt: null,
    createdBy: actorId,
    createdAt: now,
  }));
  eventTaskStore.set(eventId, [...(eventTaskStore.get(eventId) ?? []), ...copied]);
  return copied;
}
```

- [ ] **Step 4: Test laufen lassen, er muss bestehen**

Run: `pnpm vitest run apps/api/tests/project-plan-model.test.ts`
Expected: PASS (9 Tests)

- [ ] **Step 5: Commit**

```bash
npx biome format --write apps/api/src/project-plan/model.ts apps/api/tests/project-plan-model.test.ts
git add apps/api/src/project-plan/model.ts apps/api/tests/project-plan-model.test.ts
git commit -m "feat(project-plan): task, blueprint-task and tool stores with due-date helper"
```

---

### Task 3: Tools-API

**Files:**
- Create: `apps/api/src/routes/tools.ts`
- Modify: `apps/api/src/index.ts` (nach `app.route("/api/users", userSearchRoutes);`)
- Test: `apps/api/tests/tools-routes.test.ts`

**Interfaces:**
- Consumes: `TEAM_ROLES`, `getTools`, `toolStore`, `httpsUrlSchema`, `linkLabelSchema`, `ToolLink` aus Task 2
- Produces: `toolRoutes` (Hono). `GET /` → `{ tools: ToolLink[] }`. `PUT /` mit Body `{ tools: {id?, label, url}[] }` → `{ tools }`

- [ ] **Step 1: Failing Test schreiben**

```ts
// apps/api/tests/tools-routes.test.ts
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
  mexpUserStore.set(id, { id, email: `${id}@mindsquare.de`, displayName: id, roles, isActive: true, createdAt: now, updatedAt: now });
  return { "X-MSQ-User-Id": id, "X-MSQ-User-Email": `${id}@mindsquare.de`, "Content-Type": "application/json" };
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
    const denied = await app().request("/api/tools", { method: "PUT", body, headers: asUser("eo", ["event_office"]) });
    expect(denied.status).toBe(403);
    const ok = await app().request("/api/tools", { method: "PUT", body, headers: asUser("adm", ["admin"]) });
    expect(ok.status).toBe(200);
    const saved = (await ok.json()) as { tools: { id: string; label: string }[] };
    expect(saved.tools).toHaveLength(1);
    expect(saved.tools[0]?.id).toBeTruthy();
    expect(toolStore.get("default")?.updatedBy).toBe("adm");
  });

  it("lehnt http-Links ab", async () => {
    const body = JSON.stringify({ tools: [{ label: "Alt", url: "http://example.com" }] });
    const res = await app().request("/api/tools", { method: "PUT", body, headers: asUser("adm", ["admin"]) });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Test laufen lassen, er muss fehlschlagen**

Run: `pnpm vitest run apps/api/tests/tools-routes.test.ts`
Expected: FAIL – `../src/routes/tools.js` nicht gefunden

- [ ] **Step 3: Implementierung**

```ts
// apps/api/src/routes/tools.ts
import { randomUUID } from "node:crypto";
import { zValidator } from "@hono/zod-validator";
import { getHubUser } from "@mexp/auth";
import { Hono } from "hono";
import { z } from "zod";
import { TEAM_ROLES, getTools, httpsUrlSchema, linkLabelSchema, toolStore } from "../project-plan/model.js";
import { requireMexpRole } from "./_user-resolution.js";

const putSchema = z.object({
  tools: z
    .array(z.object({ id: z.string().min(1).max(100).optional(), label: linkLabelSchema, url: httpsUrlSchema }))
    .max(50),
});

// Zentrale Link-Liste externer Tools (Coworking-Copilot, Budget-Control-Agent, …).
export const toolRoutes = new Hono();

toolRoutes.get("/", requireMexpRole(...TEAM_ROLES), (c) => c.json({ tools: getTools() }));

toolRoutes.put("/", requireMexpRole("admin"), zValidator("json", putSchema), (c) => {
  const input = c.req.valid("json");
  const tools = input.tools.map((t) => ({ id: t.id ?? randomUUID(), label: t.label, url: t.url }));
  toolStore.set("default", { tools, updatedBy: getHubUser(c).id, updatedAt: new Date().toISOString() });
  return c.json({ tools });
});
```

In `apps/api/src/index.ts` den Import zu den anderen Routen-Imports ergänzen und mounten:

```ts
import { toolRoutes } from "./routes/tools.js";
// …
app.route("/api/tools", toolRoutes);
```

- [ ] **Step 4: Test laufen lassen, er muss bestehen**

Run: `pnpm vitest run apps/api/tests/tools-routes.test.ts`
Expected: PASS (4 Tests). Falls `requireMexpRole` einen unbekannten Rollen-Namen typseitig ablehnt, `TEAM_ROLES` mit `as const` beibehalten. Das Muster ist identisch mit `REQUEST_MANAGER_ROLES` in `event-requests.ts`.

- [ ] **Step 5: Commit**

```bash
npx biome format --write apps/api/src/routes/tools.ts apps/api/src/index.ts apps/api/tests/tools-routes.test.ts
git add apps/api/src/routes/tools.ts apps/api/src/index.ts apps/api/tests/tools-routes.test.ts
git commit -m "feat(tools): central external tool links, admin-maintained"
```

---

### Task 4: Event-Aufgaben-API

**Files:**
- Create: `apps/api/src/routes/event-tasks.ts`
- Modify: `apps/api/src/index.ts`
- Test: `apps/api/tests/event-tasks-routes.test.ts`

**Interfaces:**
- Consumes: `TEAM_ROLES`, `eventTaskStore`, `EventTask`, `httpsUrlSchema`, `linkLabelSchema`, `taskTitleSchema` (Task 2), `mexpUserStore` (`_user-resolution.ts`)
- Produces: `eventTaskRoutes`, gemountet unter `/api`:
  - `GET /events/:eventId/tasks` → `{ tasks: EventTask[] }`
  - `POST /events/:eventId/tasks` Body `{ title, dueDate?, assigneeId?, linkLabel?, linkUrl? }` → 201 `{ task }`
  - `PATCH /events/:eventId/tasks/:taskId` Body: beliebige Teilmenge aus `{ title, dueDate, assigneeId, linkLabel, linkUrl, done }` → `{ task }`
  - `DELETE /events/:eventId/tasks/:taskId` (nur admin) → `{ ok: true }`
  - `GET /events/:eventId/task-assignees` → `{ assignees: {id, displayName}[] }`

- [ ] **Step 1: Failing Test schreiben**

```ts
// apps/api/tests/event-tasks-routes.test.ts
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
  mexpUserStore.set(id, { id, email: `${id}@mindsquare.de`, displayName: `Name ${id}`, roles, isActive: true, createdAt: now, updatedAt: now });
  return { "X-MSQ-User-Id": id, "X-MSQ-User-Email": `${id}@mindsquare.de`, "Content-Type": "application/json" };
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
    const created = await createTask(ws, { title: "Coworking buchen", dueDate: "2027-05-21", linkLabel: "Coworking-Copilot", linkUrl: "https://personal-hub.mindsquare.de/coworking-copilot/" });
    expect(created.status).toBe(201);
    const { task } = (await created.json()) as { task: { id: string; createdBy: string } };
    expect(task.createdBy).toBe("ws");

    const patched = await app().request(`${URL_BASE}/${task.id}`, { method: "PATCH", headers: ws, body: JSON.stringify({ done: true }) });
    expect(patched.status).toBe(200);
    const { task: done } = (await patched.json()) as { task: { done: boolean; doneBy: string; doneAt: string } };
    expect(done).toMatchObject({ done: true, doneBy: "ws" });
    expect(done.doneAt).toBeTruthy();

    const reopened = await app().request(`${URL_BASE}/${task.id}`, { method: "PATCH", headers: ws, body: JSON.stringify({ done: false }) });
    expect(((await reopened.json()) as { task: { doneBy: string | null } }).task.doneBy).toBeNull();
  });

  it("verweigert Teilnehmenden den Zugriff", async () => {
    const res = await app().request(URL_BASE, { headers: asUser("p", ["participant"]) });
    expect(res.status).toBe(403);
  });

  it("lehnt Nicht-https-Links und Link ohne Text ab", async () => {
    const ws = asUser("ws", ["werkstudent"]);
    expect((await createTask(ws, { title: "X", linkLabel: "A", linkUrl: "http://a.de" })).status).toBe(400);
    expect((await createTask(ws, { title: "X", linkUrl: "https://a.de" })).status).toBe(400);
  });

  it("prüft die verantwortliche Person", async () => {
    const eo = asUser("eo", ["event_office"]);
    asUser("p", ["participant"]);
    asUser("ws", ["werkstudent"]);
    expect((await createTask(eo, { title: "X", assigneeId: "p" })).status).toBe(400);
    const ok = await createTask(eo, { title: "X", assigneeId: "ws" });
    expect(((await ok.json()) as { task: { assigneeName: string } }).task.assigneeName).toBe("Name ws");
  });

  it("nur Admins löschen", async () => {
    const eo = asUser("eo", ["event_office"]);
    const { task } = (await (await createTask(eo, { title: "X" })).json()) as { task: { id: string } };
    expect((await app().request(`${URL_BASE}/${task.id}`, { method: "DELETE", headers: eo })).status).toBe(403);
    const adm = asUser("adm", ["admin"]);
    expect((await app().request(`${URL_BASE}/${task.id}`, { method: "DELETE", headers: adm })).status).toBe(200);
    expect(eventTaskStore.get("evt1")).toEqual([]);
  });

  it("404 für unbekannte Aufgabe", async () => {
    const ws = asUser("ws", ["werkstudent"]);
    const res = await app().request(`${URL_BASE}/nope`, { method: "PATCH", headers: ws, body: JSON.stringify({ done: true }) });
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
```

- [ ] **Step 2: Test laufen lassen, er muss fehlschlagen**

Run: `pnpm vitest run apps/api/tests/event-tasks-routes.test.ts`
Expected: FAIL – Modul nicht gefunden

- [ ] **Step 3: Implementierung**

```ts
// apps/api/src/routes/event-tasks.ts
import { randomUUID } from "node:crypto";
import { zValidator } from "@hono/zod-validator";
import { getHubUser } from "@mexp/auth";
import { Hono } from "hono";
import { z } from "zod";
import {
  type EventTask,
  TEAM_ROLES,
  eventTaskStore,
  httpsUrlSchema,
  linkLabelSchema,
  taskTitleSchema,
} from "../project-plan/model.js";
import { mexpUserStore, requireMexpRole } from "./_user-resolution.js";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// Link nur komplett (Text + URL) oder gar nicht.
const linkPairOk = (v: { linkLabel?: string | null; linkUrl?: string | null }) =>
  v.linkLabel === undefined && v.linkUrl === undefined
    ? true
    : (v.linkLabel ?? null) === null
      ? (v.linkUrl ?? null) === null
      : (v.linkUrl ?? null) !== null;
const linkPairMessage = { message: "Link braucht Text und https-URL.", path: ["linkUrl"] };

const createSchema = z
  .object({
    title: taskTitleSchema,
    dueDate: dateSchema.nullable().optional(),
    assigneeId: z.string().min(1).nullable().optional(),
    linkLabel: linkLabelSchema.nullable().optional(),
    linkUrl: httpsUrlSchema.nullable().optional(),
  })
  .refine(linkPairOk, linkPairMessage);

const updateSchema = z
  .object({
    title: taskTitleSchema.optional(),
    dueDate: dateSchema.nullable().optional(),
    assigneeId: z.string().min(1).nullable().optional(),
    linkLabel: linkLabelSchema.nullable().optional(),
    linkUrl: httpsUrlSchema.nullable().optional(),
    done: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Leeres Update." })
  .refine(linkPairOk, linkPairMessage);

function teamMember(id: string) {
  const user = mexpUserStore.get(id);
  if (!user || !user.isActive || !user.roles.some((r) => (TEAM_ROLES as readonly string[]).includes(r))) {
    return null;
  }
  return { id: user.id, displayName: user.displayName ?? user.email ?? user.id };
}

const invalidAssignee = {
  error: { code: "INVALID_ASSIGNEE", message: "Diese Person gehört nicht zum Event-Team." },
};
const notFound = { error: { code: "NOT_FOUND", message: "Aufgabe nicht gefunden." } };

// Projektplan-Aufgaben je Event. Die eventId wird bewusst nicht geprüft (Spec: Events
// kommen im Datei-Modus aus drei Quellen); Aufgaben ohne Event werden nirgends angezeigt.
export const eventTaskRoutes = new Hono();

eventTaskRoutes.get("/events/:eventId/tasks", requireMexpRole(...TEAM_ROLES), (c) =>
  c.json({ tasks: eventTaskStore.get(c.req.param("eventId")) ?? [] }),
);

eventTaskRoutes.get("/events/:eventId/task-assignees", requireMexpRole(...TEAM_ROLES), (c) => {
  const assignees = Array.from(mexpUserStore.values())
    .map((u) => teamMember(u.id))
    .filter((u): u is { id: string; displayName: string } => u !== null)
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "de"));
  return c.json({ assignees });
});

eventTaskRoutes.post(
  "/events/:eventId/tasks",
  requireMexpRole(...TEAM_ROLES),
  zValidator("json", createSchema),
  (c) => {
    const eventId = c.req.param("eventId");
    const input = c.req.valid("json");
    let assignee: { id: string; displayName: string } | null = null;
    if (input.assigneeId) {
      assignee = teamMember(input.assigneeId);
      if (!assignee) return c.json(invalidAssignee, 400);
    }
    const task: EventTask = {
      id: randomUUID(),
      title: input.title,
      dueDate: input.dueDate ?? null,
      assigneeId: assignee?.id ?? null,
      assigneeName: assignee?.displayName ?? null,
      linkLabel: input.linkLabel ?? null,
      linkUrl: input.linkUrl ?? null,
      done: false,
      doneBy: null,
      doneAt: null,
      createdBy: getHubUser(c).id,
      createdAt: new Date().toISOString(),
    };
    eventTaskStore.set(eventId, [...(eventTaskStore.get(eventId) ?? []), task]);
    return c.json({ task }, 201);
  },
);

eventTaskRoutes.patch(
  "/events/:eventId/tasks/:taskId",
  requireMexpRole(...TEAM_ROLES),
  zValidator("json", updateSchema),
  (c) => {
    const eventId = c.req.param("eventId");
    const tasks = eventTaskStore.get(eventId) ?? [];
    const current = tasks.find((t) => t.id === c.req.param("taskId"));
    if (!current) return c.json(notFound, 404);
    const input = c.req.valid("json");
    const updated: EventTask = { ...current };
    if (input.title !== undefined) updated.title = input.title;
    if (input.dueDate !== undefined) updated.dueDate = input.dueDate;
    if (input.linkLabel !== undefined) updated.linkLabel = input.linkLabel;
    if (input.linkUrl !== undefined) updated.linkUrl = input.linkUrl;
    if (input.assigneeId !== undefined) {
      if (input.assigneeId === null) {
        updated.assigneeId = null;
        updated.assigneeName = null;
      } else {
        const assignee = teamMember(input.assigneeId);
        if (!assignee) return c.json(invalidAssignee, 400);
        updated.assigneeId = assignee.id;
        updated.assigneeName = assignee.displayName;
      }
    }
    if (input.done !== undefined && input.done !== current.done) {
      updated.done = input.done;
      updated.doneBy = input.done ? getHubUser(c).id : null;
      updated.doneAt = input.done ? new Date().toISOString() : null;
    }
    eventTaskStore.set(
      eventId,
      tasks.map((t) => (t.id === updated.id ? updated : t)),
    );
    return c.json({ task: updated });
  },
);

// Löschen nur Admin (Sinas Regel: Anlegen/Bearbeiten dürfen mehr Rollen, Löschen nicht).
eventTaskRoutes.delete("/events/:eventId/tasks/:taskId", requireMexpRole("admin"), (c) => {
  const eventId = c.req.param("eventId");
  const tasks = eventTaskStore.get(eventId) ?? [];
  const taskId = c.req.param("taskId");
  if (!tasks.some((t) => t.id === taskId)) return c.json(notFound, 404);
  eventTaskStore.set(
    eventId,
    tasks.filter((t) => t.id !== taskId),
  );
  return c.json({ ok: true });
});
```

In `apps/api/src/index.ts`:

```ts
import { eventTaskRoutes } from "./routes/event-tasks.js";
// …
app.route("/api", eventTaskRoutes);
```

- [ ] **Step 4: Test laufen lassen, er muss bestehen**

Run: `pnpm vitest run apps/api/tests/event-tasks-routes.test.ts`
Expected: PASS (7 Tests)

- [ ] **Step 5: Commit**

```bash
npx biome format --write apps/api/src/routes/event-tasks.ts apps/api/src/index.ts apps/api/tests/event-tasks-routes.test.ts
git add apps/api/src/routes/event-tasks.ts apps/api/src/index.ts apps/api/tests/event-tasks-routes.test.ts
git commit -m "feat(event-tasks): project plan task API per event"
```

---

### Task 5: Blueprint-Aufgaben-API und Kopieren beim Anwenden

**Files:**
- Create: `apps/api/src/routes/blueprint-tasks.ts`
- Modify: `apps/api/src/routes/blueprints.ts` (Import, Mount, `/:id/apply`)
- Test: `apps/api/tests/blueprint-tasks-routes.test.ts`

**Interfaces:**
- Consumes: `TEAM_ROLES`, `blueprintTaskStore`, `BlueprintTask`, `httpsUrlSchema`, `linkLabelSchema`, `taskTitleSchema`, `copyBlueprintTasksToEvent` (Task 2)
- Produces: `createBlueprintTaskRoutes(blueprintExists: (id: string) => Promise<boolean>): Hono` mit `GET /:id/tasks` → `{ tasks: BlueprintTask[] }` und `PUT /:id/tasks` Body `{ tasks: {id?, title, daysBefore, linkLabel, linkUrl}[] }` → `{ tasks }`

- [ ] **Step 1: Failing Test schreiben**

```ts
// apps/api/tests/blueprint-tasks-routes.test.ts
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
  a.route("/api/blueprints", createBlueprintTaskRoutes(async (id) => id === "bp1"));
  return a;
}

function asUser(id: string, roles: string[]) {
  const now = new Date().toISOString();
  mexpUserStore.set(id, { id, email: `${id}@mindsquare.de`, displayName: id, roles, isActive: true, createdAt: now, updatedAt: now });
  return { "X-MSQ-User-Id": id, "X-MSQ-User-Email": `${id}@mindsquare.de`, "Content-Type": "application/json" };
}

const tasks = [
  { title: "Coworking buchen", daysBefore: 30, linkLabel: "Coworking-Copilot", linkUrl: "https://personal-hub.mindsquare.de/coworking-copilot/" },
  { title: "Einladung verschicken", daysBefore: null, linkLabel: null, linkUrl: null },
];

describe("Blueprint-Aufgaben-API", () => {
  beforeEach(() => {
    mexpUserStore.clear();
    blueprintTaskStore.clear();
  });

  it("Werkstudent speichert und liest die Liste", async () => {
    const ws = asUser("ws", ["werkstudent"]);
    const put = await app().request("/api/blueprints/bp1/tasks", { method: "PUT", headers: ws, body: JSON.stringify({ tasks }) });
    expect(put.status).toBe(200);
    const get = await app().request("/api/blueprints/bp1/tasks", { headers: ws });
    const body = (await get.json()) as { tasks: { id: string; title: string }[] };
    expect(body.tasks.map((t) => t.title)).toEqual(["Coworking buchen", "Einladung verschicken"]);
    expect(body.tasks[0]?.id).toBeTruthy();
  });

  it("404 für unbekannten Blueprint", async () => {
    const res = await app().request("/api/blueprints/bp-x/tasks", { headers: asUser("ws", ["werkstudent"]) });
    expect(res.status).toBe(404);
  });

  it("verweigert Teilnehmenden", async () => {
    const res = await app().request("/api/blueprints/bp1/tasks", { headers: asUser("p", ["participant"]) });
    expect(res.status).toBe(403);
  });

  it("lehnt daysBefore außerhalb 0–365 ab", async () => {
    const res = await app().request("/api/blueprints/bp1/tasks", {
      method: "PUT",
      headers: asUser("ws", ["werkstudent"]),
      body: JSON.stringify({ tasks: [{ title: "X", daysBefore: 400, linkLabel: null, linkUrl: null }] }),
    });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Test laufen lassen, er muss fehlschlagen**

Run: `pnpm vitest run apps/api/tests/blueprint-tasks-routes.test.ts`
Expected: FAIL – Modul nicht gefunden

- [ ] **Step 3: Implementierung Routenmodul**

```ts
// apps/api/src/routes/blueprint-tasks.ts
import { randomUUID } from "node:crypto";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import {
  type BlueprintTask,
  TEAM_ROLES,
  blueprintTaskStore,
  httpsUrlSchema,
  linkLabelSchema,
  taskTitleSchema,
} from "../project-plan/model.js";
import { requireMexpRole } from "./_user-resolution.js";

const putSchema = z.object({
  tasks: z
    .array(
      z
        .object({
          id: z.string().min(1).max(100).optional(),
          title: taskTitleSchema,
          daysBefore: z.number().int().min(0).max(365).nullable(),
          linkLabel: linkLabelSchema.nullable(),
          linkUrl: httpsUrlSchema.nullable(),
        })
        .refine((t) => (t.linkLabel === null) === (t.linkUrl === null), {
          message: "Link braucht Text und https-URL.",
          path: ["linkUrl"],
        }),
    )
    .max(100),
});

const notFound = { error: { code: "BLUEPRINT_NOT_FOUND", message: "Blueprint nicht gefunden" } };

/**
 * Aufgaben-Vorlagen je Blueprint. Die Existenzprüfung wird injiziert, damit das Modul
 * ohne deps.ts (Postgres/LLM) testbar bleibt — blueprints.ts reicht die echte Prüfung rein.
 */
export function createBlueprintTaskRoutes(blueprintExists: (id: string) => Promise<boolean>) {
  const routes = new Hono();

  routes.get("/:id/tasks", requireMexpRole(...TEAM_ROLES), async (c) => {
    const id = c.req.param("id");
    if (!(await blueprintExists(id))) return c.json(notFound, 404);
    return c.json({ tasks: blueprintTaskStore.get(id) ?? [] });
  });

  routes.put("/:id/tasks", requireMexpRole(...TEAM_ROLES), zValidator("json", putSchema), async (c) => {
    const id = c.req.param("id");
    if (!(await blueprintExists(id))) return c.json(notFound, 404);
    const tasks: BlueprintTask[] = c.req.valid("json").tasks.map((t) => ({
      id: t.id ?? randomUUID(),
      title: t.title,
      daysBefore: t.daysBefore,
      linkLabel: t.linkLabel,
      linkUrl: t.linkUrl,
    }));
    blueprintTaskStore.set(id, tasks);
    return c.json({ tasks });
  });

  return routes;
}
```

- [ ] **Step 4: Test laufen lassen, er muss bestehen**

Run: `pnpm vitest run apps/api/tests/blueprint-tasks-routes.test.ts`
Expected: PASS (4 Tests)

- [ ] **Step 5: In blueprints.ts einhängen und beim Anwenden kopieren**

Oben in `apps/api/src/routes/blueprints.ts` ergänzen:

```ts
import { blueprintTaskStore, copyBlueprintTasksToEvent } from "../project-plan/model.js";
import { createBlueprintTaskRoutes } from "./blueprint-tasks.js";
```

Direkt nach `const devBlueprintStore = persistentMap<DevBlueprint>("blueprints");` und der Erzeugung von `blueprintRoutes` (die Zeile `export const blueprintRoutes = new Hono();`) einfügen:

```ts
blueprintRoutes.route(
  "/",
  createBlueprintTaskRoutes(async (id) =>
    env.DATABASE_URL ? (await blueprints.findById(id)) !== null : devBlueprintStore.has(id),
  ),
);
```

Im `/:id/apply`-Handler beide Rückgabepfade ändern. Dev-Zweig:

```ts
      copyBlueprintTasksToEvent(id, event.id, startAt.toISOString(), actorId);
      return c.json({ event }, 201);
```

DB-Zweig:

```ts
    copyBlueprintTasksToEvent(id, event.id, new Date(input.startAt).toISOString(), actorId);
    return c.json({ event }, 201);
```

Im Delete-Handler des Blueprints (vor beiden `return c.json({ ok: true })`) die Vorlagen-Aufgaben mitlöschen:

```ts
  blueprintTaskStore.delete(id);
```

- [ ] **Step 6: Gesamte Tests und Typcheck**

Run: `pnpm test && pnpm --filter @mexp/api typecheck`
Expected: alle Tests PASS, keine Typfehler

- [ ] **Step 7: Commit**

```bash
npx biome format --write apps/api/src/routes/blueprint-tasks.ts apps/api/src/routes/blueprints.ts apps/api/tests/blueprint-tasks-routes.test.ts
git add apps/api/src/routes/blueprint-tasks.ts apps/api/src/routes/blueprints.ts apps/api/tests/blueprint-tasks-routes.test.ts
git commit -m "feat(blueprints): task templates per blueprint, copied when an event is created"
```

---

### Task 6: Frontend-Grundlagen (DTOs, Task-Utils, i18n)

**Files:**
- Create: `apps/web/src/events/project-plan-types.ts`
- Create: `apps/web/src/events/task-utils.ts`
- Create: `apps/web/src/events/external-links.ts`
- Test: `apps/web/src/events/task-utils.test.ts`
- Modify: `apps/web/src/locales/de.json`, `apps/web/src/locales/en.json` (neuer Top-Level-Block `projectPlan`)

**Interfaces:**
- Produces:
  - `EventTaskDto`, `BlueprintTaskDto`, `ToolLinkDto`, `AssigneeDto` (Felder 1:1 wie API)
  - `sortTasks(tasks: EventTaskDto[]): EventTaskDto[]`: offene nach `dueDate` aufsteigend, ohne Datum zuletzt, danach erledigte
  - `taskProgress(tasks): { done: number; total: number; percent: number }`
  - `isOverdue(task, today: string /* YYYY-MM-DD */): boolean`
  - `todayIso(): string`
  - `BUDGET_TOOL_URL`
  - i18n-Schlüssel `projectPlan.*` (Liste in Step 5)

- [ ] **Step 1: Failing Test schreiben**

```ts
// apps/web/src/events/task-utils.test.ts
import { describe, expect, it } from "vitest";
import type { EventTaskDto } from "./project-plan-types";
import { isOverdue, sortTasks, taskProgress } from "./task-utils";

function task(id: string, over: Partial<EventTaskDto> = {}): EventTaskDto {
  return {
    id, title: id, dueDate: null, assigneeId: null, assigneeName: null, linkLabel: null, linkUrl: null,
    done: false, doneBy: null, doneAt: null, createdBy: "u", createdAt: "2026-10-01T00:00:00.000Z", ...over,
  };
}

describe("sortTasks", () => {
  it("offene nach Fälligkeit, ohne Datum danach, erledigte zuletzt", () => {
    const sorted = sortTasks([
      task("done", { done: true, dueDate: "2026-01-01" }),
      task("noDate"),
      task("late", { dueDate: "2026-12-01" }),
      task("early", { dueDate: "2026-11-01" }),
    ]);
    expect(sorted.map((t) => t.id)).toEqual(["early", "late", "noDate", "done"]);
  });
});

describe("taskProgress", () => {
  it("zählt erledigte", () => {
    expect(taskProgress([task("a", { done: true }), task("b")])).toEqual({ done: 1, total: 2, percent: 50 });
  });
  it("0 % bei leerer Liste", () => {
    expect(taskProgress([])).toEqual({ done: 0, total: 0, percent: 0 });
  });
});

describe("isOverdue", () => {
  it("offen und Fälligkeit vor heute", () => {
    expect(isOverdue(task("a", { dueDate: "2026-10-22" }), "2026-10-23")).toBe(true);
  });
  it("heute fällig ist nicht überfällig", () => {
    expect(isOverdue(task("a", { dueDate: "2026-10-23" }), "2026-10-23")).toBe(false);
  });
  it("erledigt oder ohne Datum nie überfällig", () => {
    expect(isOverdue(task("a", { dueDate: "2026-01-01", done: true }), "2026-10-23")).toBe(false);
    expect(isOverdue(task("a"), "2026-10-23")).toBe(false);
  });
});
```

- [ ] **Step 2: Test laufen lassen, er muss fehlschlagen**

Run: `pnpm vitest run apps/web/src/events/task-utils.test.ts`
Expected: FAIL – Module nicht gefunden

- [ ] **Step 3: Implementierung**

```ts
// apps/web/src/events/project-plan-types.ts
// Spiegel der API-Typen aus apps/api/src/project-plan/model.ts
export interface EventTaskDto {
  id: string;
  title: string;
  dueDate: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  linkLabel: string | null;
  linkUrl: string | null;
  done: boolean;
  doneBy: string | null;
  doneAt: string | null;
  createdBy: string;
  createdAt: string;
}

export interface BlueprintTaskDto {
  id?: string;
  title: string;
  daysBefore: number | null;
  linkLabel: string | null;
  linkUrl: string | null;
}

export interface ToolLinkDto {
  id?: string;
  label: string;
  url: string;
}

export interface AssigneeDto {
  id: string;
  displayName: string;
}
```

```ts
// apps/web/src/events/task-utils.ts
import type { EventTaskDto } from "./project-plan-types";

/** Offene Aufgaben nach Fälligkeit (ohne Datum zuletzt), erledigte darunter. */
export function sortTasks(tasks: EventTaskDto[]): EventTaskDto[] {
  const byDue = (a: EventTaskDto, b: EventTaskDto) => {
    if (a.dueDate === b.dueDate) return a.createdAt.localeCompare(b.createdAt);
    if (a.dueDate === null) return 1;
    if (b.dueDate === null) return -1;
    return a.dueDate.localeCompare(b.dueDate);
  };
  const open = tasks.filter((t) => !t.done).sort(byDue);
  const done = tasks.filter((t) => t.done).sort(byDue);
  return [...open, ...done];
}

export function taskProgress(tasks: EventTaskDto[]) {
  const done = tasks.filter((t) => t.done).length;
  const total = tasks.length;
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}

export function isOverdue(task: EventTaskDto, today: string): boolean {
  return !task.done && task.dueDate !== null && task.dueDate < today;
}

/** Heutiges Datum in lokaler Zeit als YYYY-MM-DD. */
export function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
```

```ts
// apps/web/src/events/external-links.ts
// Fest verdrahtet (Spec): der Budget-Kasten soll nicht kaputtgehen, wenn jemand
// den Eintrag aus der Tools-Liste löscht.
export const BUDGET_TOOL_URL = "https://personal-hub.mindsquare.de/budget-control-agent/";
```

- [ ] **Step 4: Test laufen lassen, er muss bestehen**

Run: `pnpm vitest run apps/web/src/events/task-utils.test.ts`
Expected: PASS (6 Tests)

- [ ] **Step 5: i18n-Schlüssel ergänzen**

In `apps/web/src/locales/de.json` einen neuen Top-Level-Block `"projectPlan"` einfügen (nach `"documents"`):

```json
"projectPlan": {
  "phaseDraft": "Entwurf",
  "phasePlanned": "Geplant",
  "phaseOpen": "Anmeldung offen",
  "phaseRunning": "Läuft",
  "phaseClosed": "Abgeschlossen",
  "phaseSwitchTo": "Phase wechseln zu „{{phase}}“",
  "cancelledNotice": "Dieses Event wurde abgesagt.",
  "cancelEvent": "Event absagen",
  "confirmCancel": "Event wirklich absagen?",
  "tasksTitle": "Aufgaben",
  "tasksProgress": "{{done}} / {{total}} erledigt",
  "tasksEmpty": "Noch keine Aufgaben. Lege die erste an oder nutze beim nächsten Event eine Vorlage mit Aufgaben.",
  "addTask": "Aufgabe hinzufügen",
  "taskTitle": "Aufgabe",
  "taskDue": "Fällig am",
  "taskAssignee": "Verantwortlich",
  "taskNoAssignee": "— niemand —",
  "taskLinkLabel": "Link-Text",
  "taskLinkUrl": "Link (https://…)",
  "taskOverdue": "überfällig",
  "taskDueOn": "bis {{date}}",
  "save": "Speichern",
  "cancel": "Abbrechen",
  "edit": "Bearbeiten",
  "delete": "Löschen",
  "confirmDeleteTask": "Aufgabe wirklich löschen?",
  "markDone": "Als erledigt markieren",
  "toolsTitle": "Tools",
  "toolsEmpty": "Keine Tools hinterlegt.",
  "keyFiguresTitle": "Kennzahlen",
  "registrations": "Anmeldungen",
  "budgetTitle": "Budget",
  "budgetHint": "Das Budget wird im Budget-Control-Agent gepflegt.",
  "budgetOpen": "Zum Budget-Tool",
  "adminToolsTitle": "Tools für den Projektplan",
  "adminToolsHint": "Diese Links erscheinen bei jedem Event im Kasten „Tools“. Nur https-Links.",
  "addTool": "Tool hinzufügen",
  "toolLabel": "Name",
  "toolUrl": "Link",
  "saved": "Gespeichert",
  "moveUp": "Nach oben",
  "moveDown": "Nach unten",
  "blueprintTasks": "Aufgaben",
  "blueprintTasksTitle": "Aufgaben der Vorlage „{{name}}“",
  "blueprintTasksHint": "Werden beim Anlegen eines Events aus dieser Vorlage übernommen. Fälligkeit = Event-Start minus Tage.",
  "daysBefore": "Tage vorher"
}
```

In `apps/web/src/locales/en.json` denselben Block auf Englisch:

```json
"projectPlan": {
  "phaseDraft": "Draft",
  "phasePlanned": "Planned",
  "phaseOpen": "Registration open",
  "phaseRunning": "Running",
  "phaseClosed": "Closed",
  "phaseSwitchTo": "Switch phase to “{{phase}}”",
  "cancelledNotice": "This event has been cancelled.",
  "cancelEvent": "Cancel event",
  "confirmCancel": "Really cancel this event?",
  "tasksTitle": "Tasks",
  "tasksProgress": "{{done}} / {{total}} done",
  "tasksEmpty": "No tasks yet. Add the first one or use a template with tasks for your next event.",
  "addTask": "Add task",
  "taskTitle": "Task",
  "taskDue": "Due on",
  "taskAssignee": "Owner",
  "taskNoAssignee": "— nobody —",
  "taskLinkLabel": "Link text",
  "taskLinkUrl": "Link (https://…)",
  "taskOverdue": "overdue",
  "taskDueOn": "by {{date}}",
  "save": "Save",
  "cancel": "Cancel",
  "edit": "Edit",
  "delete": "Delete",
  "confirmDeleteTask": "Really delete this task?",
  "markDone": "Mark as done",
  "toolsTitle": "Tools",
  "toolsEmpty": "No tools configured.",
  "keyFiguresTitle": "Key figures",
  "registrations": "Registrations",
  "budgetTitle": "Budget",
  "budgetHint": "The budget is managed in the Budget Control Agent.",
  "budgetOpen": "Open budget tool",
  "adminToolsTitle": "Tools for the project plan",
  "adminToolsHint": "These links appear on every event in the “Tools” box. https links only.",
  "addTool": "Add tool",
  "toolLabel": "Name",
  "toolUrl": "Link",
  "saved": "Saved",
  "moveUp": "Move up",
  "moveDown": "Move down",
  "blueprintTasks": "Tasks",
  "blueprintTasksTitle": "Tasks of template “{{name}}”",
  "blueprintTasksHint": "Copied into every event created from this template. Due date = event start minus days.",
  "daysBefore": "Days before"
}
```

Zusätzlich in beiden Dateien im Block `admin` den Schlüssel `"tabTools": "Tools"` ergänzen.

- [ ] **Step 6: Commit**

```bash
npx biome format --write apps/web/src/events/project-plan-types.ts apps/web/src/events/task-utils.ts apps/web/src/events/task-utils.test.ts apps/web/src/events/external-links.ts apps/web/src/locales/de.json apps/web/src/locales/en.json
git add apps/web/src/events/project-plan-types.ts apps/web/src/events/task-utils.ts apps/web/src/events/task-utils.test.ts apps/web/src/events/external-links.ts apps/web/src/locales/de.json apps/web/src/locales/en.json
git commit -m "feat(web): project plan types, task helpers and translations"
```

---

### Task 7: Tools-Kasten, Budget-Kasten und Admin-Reiter „Tools“

**Files:**
- Create: `apps/web/src/events/tools-card.tsx`
- Create: `apps/web/src/events/budget-link-card.tsx`
- Create: `apps/web/src/admin/tools-panel.tsx`
- Modify: `apps/web/src/pages/admin.tsx`

**Interfaces:**
- Consumes: `ToolLinkDto`, `BUDGET_TOOL_URL` (Task 6), `GET/PUT /tools` (Task 3)
- Produces: `<ToolsCard />`, `<BudgetLinkCard />` (ohne Props), `<ToolsPanel />`. Query-Key `["tools"]`

- [ ] **Step 1: ToolsCard**

```tsx
// apps/web/src/events/tools-card.tsx
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../api/client";
import type { ToolLinkDto } from "./project-plan-types";

/** Zentrale Tools-Liste (Admin → Tools), in jedem Event gleich. */
export function ToolsCard() {
  const { t } = useTranslation();
  const q = useQuery({
    queryKey: ["tools"],
    queryFn: () => apiFetch<{ tools: ToolLinkDto[] }>("/tools"),
  });
  const tools = q.data?.tools ?? [];
  return (
    <div className="card">
      <h2 className="card-title">{t("projectPlan.toolsTitle")}</h2>
      {tools.length === 0 ? (
        <p className="muted">{t("projectPlan.toolsEmpty")}</p>
      ) : (
        <div className="stack" style={{ gap: "var(--space-2)", marginTop: "var(--space-3)" }}>
          {tools.map((tool) => (
            <a
              key={tool.id ?? tool.url}
              href={tool.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline btn-sm"
            >
              ↗ {tool.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: BudgetLinkCard**

```tsx
// apps/web/src/events/budget-link-card.tsx
import { useTranslation } from "react-i18next";
import { BUDGET_TOOL_URL } from "./external-links";

/** Ersetzt BudgetPanel: das Budget lebt im Budget-Control-Agent (keine Doppelerfassung). */
export function BudgetLinkCard() {
  const { t } = useTranslation();
  return (
    <div className="card">
      <h2 className="card-title">{t("projectPlan.budgetTitle")}</h2>
      <p className="muted" style={{ marginTop: "var(--space-2)" }}>
        {t("projectPlan.budgetHint")}
      </p>
      <a
        href={BUDGET_TOOL_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-primary btn-sm"
        style={{ marginTop: "var(--space-3)" }}
      >
        ↗ {t("projectPlan.budgetOpen")}
      </a>
    </div>
  );
}
```

- [ ] **Step 3: ToolsPanel (Admin)**

```tsx
// apps/web/src/admin/tools-panel.tsx
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../api/client";
import type { ToolLinkDto } from "../events/project-plan-types";

export function ToolsPanel() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["tools"], queryFn: () => apiFetch<{ tools: ToolLinkDto[] }>("/tools") });
  const [rows, setRows] = useState<ToolLinkDto[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (q.data) setRows(q.data.tools);
  }, [q.data]);

  const saveMut = useMutation({
    mutationFn: (tools: ToolLinkDto[]) =>
      apiFetch<{ tools: ToolLinkDto[] }>("/tools", { method: "PUT", body: JSON.stringify({ tools }) }),
    onSuccess: (data) => {
      qc.setQueryData(["tools"], data);
      setSaved(true);
    },
  });

  const update = (i: number, patch: Partial<ToolLinkDto>) => {
    setSaved(false);
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  };
  const move = (i: number, dir: -1 | 1) => {
    setSaved(false);
    setRows((r) => {
      const next = [...r];
      const j = i + dir;
      if (j < 0 || j >= next.length) return r;
      [next[i], next[j]] = [next[j] as ToolLinkDto, next[i] as ToolLinkDto];
      return next;
    });
  };

  return (
    <div className="card">
      <h2 className="card-title">{t("projectPlan.adminToolsTitle")}</h2>
      <p className="muted">{t("projectPlan.adminToolsHint")}</p>
      <div className="stack" style={{ gap: "var(--space-2)", marginTop: "var(--space-3)" }}>
        {rows.map((row, i) => (
          <div key={row.id ?? `new-${i}`} className="row" style={{ gap: "var(--space-2)" }}>
            <input
              className="input"
              aria-label={t("projectPlan.toolLabel")}
              placeholder={t("projectPlan.toolLabel")}
              value={row.label}
              maxLength={100}
              onChange={(e) => update(i, { label: e.target.value })}
            />
            <input
              className="input"
              style={{ flex: 2 }}
              aria-label={t("projectPlan.toolUrl")}
              placeholder="https://…"
              value={row.url}
              maxLength={2000}
              onChange={(e) => update(i, { url: e.target.value })}
            />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => move(i, -1)} title={t("projectPlan.moveUp")}>↑</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => move(i, 1)} title={t("projectPlan.moveDown")}>↓</button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setSaved(false);
                setRows((r) => r.filter((_, idx) => idx !== i));
              }}
            >
              {t("projectPlan.delete")}
            </button>
          </div>
        ))}
      </div>
      <div className="row" style={{ gap: "var(--space-2)", marginTop: "var(--space-3)" }}>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => {
            setSaved(false);
            setRows((r) => [...r, { label: "", url: "https://" }]);
          }}
        >
          + {t("projectPlan.addTool")}
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={saveMut.isPending}
          onClick={() => saveMut.mutate(rows)}
        >
          {t("projectPlan.save")}
        </button>
        {saved && <span className="muted">✓ {t("projectPlan.saved")}</span>}
      </div>
      {saveMut.error instanceof Error && (
        <div className="alert alert-error" style={{ marginTop: "var(--space-3)" }}>
          {saveMut.error.message}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Admin-Reiter**

In `apps/web/src/pages/admin.tsx`:

```tsx
import { ToolsPanel } from "../admin/tools-panel";
```

Nach dem Import-NavLink:

```tsx
        {isAdmin && (
          <NavLink to="/admin/tools" className={tabClass}>
            {t("admin.tabTools")}
          </NavLink>
        )}
```

Bei den Routen nach `import`:

```tsx
        {isAdmin && <Route path="tools" element={<ToolsPanel />} />}
```

- [ ] **Step 5: Typcheck + Lint**

Run: `pnpm --filter @mexp/web typecheck && npx biome check apps/web/src/events/tools-card.tsx apps/web/src/events/budget-link-card.tsx apps/web/src/admin/tools-panel.tsx apps/web/src/pages/admin.tsx`
Expected: keine Fehler. Falls die Klasse `stack` nicht existiert (`grep -rn "\.stack" apps/web/src/styles`), stattdessen `style={{ display: "flex", flexDirection: "column", gap: … }}` verwenden.

- [ ] **Step 6: Commit**

```bash
npx biome format --write apps/web/src/events/tools-card.tsx apps/web/src/events/budget-link-card.tsx apps/web/src/admin/tools-panel.tsx apps/web/src/pages/admin.tsx
git add apps/web/src/events/tools-card.tsx apps/web/src/events/budget-link-card.tsx apps/web/src/admin/tools-panel.tsx apps/web/src/pages/admin.tsx
git commit -m "feat(web): tools card, budget link card and admin tools tab"
```

---

### Task 8: Phasen-Leiste, Kennzahlen, Checkliste und neues Detail-Layout

**Files:**
- Create: `apps/web/src/events/phase-bar.tsx`
- Create: `apps/web/src/events/key-figures-card.tsx`
- Create: `apps/web/src/events/task-checklist.tsx`
- Modify: `apps/web/src/pages/event-detail.tsx` (Status-Karte ~Z. 256–278, Panels ~Z. 280–285)
- Modify: das globale Stylesheet unter `apps/web/src/styles/` (die Datei, die `.card` definiert: `grep -ln "^\.card" apps/web/src/styles/*`)

**Interfaces:**
- Consumes: `EventDto`, `EventStatus`, `allowedTransitions` (`events/types.ts`), `EventTaskDto`, `AssigneeDto`, `sortTasks`, `taskProgress`, `isOverdue`, `todayIso` (Task 6), Event-Aufgaben-API (Task 4), `ToolsCard`, `BudgetLinkCard` (Task 7)
- Produces: `<PhaseBar status onTransition pending />`, `<KeyFiguresCard event />`, `<TaskChecklist eventId />`

- [ ] **Step 1: PhaseBar**

```tsx
// apps/web/src/events/phase-bar.tsx
import { useTranslation } from "react-i18next";
import { type EventStatus, allowedTransitions } from "./types";

const PHASES: { status: EventStatus; key: string }[] = [
  { status: "draft", key: "projectPlan.phaseDraft" },
  { status: "planned", key: "projectPlan.phasePlanned" },
  { status: "open", key: "projectPlan.phaseOpen" },
  { status: "running", key: "projectPlan.phaseRunning" },
  { status: "closed", key: "projectPlan.phaseClosed" },
];

interface Props {
  status: EventStatus;
  pending: boolean;
  onTransition: (status: EventStatus) => void;
}

/** Status als Fortschrittsleiste; erlaubte Phasen sind klickbar (ersetzt "Status ändern"). */
export function PhaseBar({ status, pending, onTransition }: Props) {
  const { t } = useTranslation();
  const allowed = allowedTransitions(status);

  if (status === "cancelled") {
    return (
      <div className="alert alert-error" role="status">
        {t("projectPlan.cancelledNotice")}
      </div>
    );
  }

  const currentIndex = PHASES.findIndex((p) => p.status === status);
  return (
    <div className="card">
      <div className="phase-bar">
        {PHASES.map((phase, i) => {
          const state = i < currentIndex ? "done" : i === currentIndex ? "current" : "todo";
          const clickable = allowed.includes(phase.status) && !pending;
          const label = t(phase.key);
          return (
            <button
              key={phase.status}
              type="button"
              className={`phase-step phase-step--${state}`}
              disabled={!clickable}
              aria-current={state === "current" ? "step" : undefined}
              title={clickable ? t("projectPlan.phaseSwitchTo", { phase: label }) : undefined}
              onClick={() => onTransition(phase.status)}
            >
              {state === "done" ? "✓ " : state === "current" ? "● " : ""}
              {label}
            </button>
          );
        })}
      </div>
      {allowed.includes("cancelled") && (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ marginTop: "var(--space-3)" }}
          disabled={pending}
          onClick={() => {
            if (window.confirm(t("projectPlan.confirmCancel"))) onTransition("cancelled");
          }}
        >
          {t("projectPlan.cancelEvent")}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: KeyFiguresCard**

```tsx
// apps/web/src/events/key-figures-card.tsx
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../api/client";
import type { EventDto, ParticipantDto } from "./types";

export function KeyFiguresCard({ event }: { event: EventDto }) {
  const { t } = useTranslation();
  // Gleicher Query-Key wie ParticipantsPanel → kein zusätzlicher Request.
  const q = useQuery({
    queryKey: ["events", event.id, "participants"],
    queryFn: () => apiFetch<{ participants: ParticipantDto[] }>(`/events/${event.id}/participants`),
  });
  const registered = (q.data?.participants ?? []).filter(
    (p) => p.status === "registered" || p.status === "attended",
  ).length;
  return (
    <div className="card">
      <h2 className="card-title">{t("projectPlan.keyFiguresTitle")}</h2>
      <div style={{ marginTop: "var(--space-2)" }}>
        👥 {t("projectPlan.registrations")}: <strong>{registered}</strong>
        {event.capacity ? ` / ${event.capacity}` : ""}
      </div>
    </div>
  );
}
```

Vor dem Schreiben prüfen: `grep -n "PARTICIPATION_STATUSES = \[" -A8 apps/web/src/events/types.ts`. Wenn die Status anders heißen als `registered`/`attended`, die Filterbedingung entsprechend anpassen.

- [ ] **Step 3: TaskChecklist**

```tsx
// apps/web/src/events/task-checklist.tsx
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../api/client";
import { useAuth } from "../auth/auth-context";
import type { AssigneeDto, EventTaskDto } from "./project-plan-types";
import { isOverdue, sortTasks, taskProgress, todayIso } from "./task-utils";

interface Draft {
  title: string;
  dueDate: string;
  assigneeId: string;
  linkLabel: string;
  linkUrl: string;
}

const emptyDraft: Draft = { title: "", dueDate: "", assigneeId: "", linkLabel: "", linkUrl: "" };

function toDraft(task: EventTaskDto): Draft {
  return {
    title: task.title,
    dueDate: task.dueDate ?? "",
    assigneeId: task.assigneeId ?? "",
    linkLabel: task.linkLabel ?? "",
    linkUrl: task.linkUrl ?? "",
  };
}

function toPayload(d: Draft) {
  const hasLink = d.linkLabel.trim() !== "" || d.linkUrl.trim() !== "";
  return {
    title: d.title.trim(),
    dueDate: d.dueDate || null,
    assigneeId: d.assigneeId || null,
    linkLabel: hasLink ? d.linkLabel.trim() : null,
    linkUrl: hasLink ? d.linkUrl.trim() : null,
  };
}

function fmtDay(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("de-DE");
}

export function TaskChecklist({ eventId }: { eventId: string }) {
  const { t } = useTranslation();
  const { hasRole } = useAuth();
  const canDelete = hasRole("admin");
  const qc = useQueryClient();
  const key = ["events", eventId, "tasks"];
  const today = todayIso();

  const tasksQ = useQuery({
    queryKey: key,
    queryFn: () => apiFetch<{ tasks: EventTaskDto[] }>(`/events/${eventId}/tasks`),
  });
  const assigneesQ = useQuery({
    queryKey: ["events", eventId, "task-assignees"],
    queryFn: () => apiFetch<{ assignees: AssigneeDto[] }>(`/events/${eventId}/task-assignees`),
  });

  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const invalidate = () => qc.invalidateQueries({ queryKey: key });

  const saveMut = useMutation({
    mutationFn: ({ id, body }: { id: string | "new"; body: object }) =>
      id === "new"
        ? apiFetch(`/events/${eventId}/tasks`, { method: "POST", body: JSON.stringify(body) })
        : apiFetch(`/events/${eventId}/tasks/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => {
      setEditingId(null);
      invalidate();
    },
  });
  const toggleMut = useMutation({
    mutationFn: (task: EventTaskDto) =>
      apiFetch(`/events/${eventId}/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ done: !task.done }),
      }),
    onSuccess: invalidate,
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/events/${eventId}/tasks/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const tasks = sortTasks(tasksQ.data?.tasks ?? []);
  const progress = taskProgress(tasks);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (editingId) saveMut.mutate({ id: editingId, body: toPayload(draft) });
  };

  const form = (
    <form onSubmit={submit} className="task-form">
      <input
        className="input"
        required
        maxLength={200}
        placeholder={t("projectPlan.taskTitle")}
        aria-label={t("projectPlan.taskTitle")}
        value={draft.title}
        onChange={(e) => setDraft({ ...draft, title: e.target.value })}
      />
      <input
        className="input"
        type="date"
        aria-label={t("projectPlan.taskDue")}
        value={draft.dueDate}
        onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })}
      />
      <select
        className="input"
        aria-label={t("projectPlan.taskAssignee")}
        value={draft.assigneeId}
        onChange={(e) => setDraft({ ...draft, assigneeId: e.target.value })}
      >
        <option value="">{t("projectPlan.taskNoAssignee")}</option>
        {(assigneesQ.data?.assignees ?? []).map((a) => (
          <option key={a.id} value={a.id}>
            {a.displayName}
          </option>
        ))}
      </select>
      <input
        className="input"
        maxLength={100}
        placeholder={t("projectPlan.taskLinkLabel")}
        aria-label={t("projectPlan.taskLinkLabel")}
        value={draft.linkLabel}
        onChange={(e) => setDraft({ ...draft, linkLabel: e.target.value })}
      />
      <input
        className="input"
        type="url"
        maxLength={2000}
        pattern="https://.*"
        placeholder={t("projectPlan.taskLinkUrl")}
        aria-label={t("projectPlan.taskLinkUrl")}
        value={draft.linkUrl}
        onChange={(e) => setDraft({ ...draft, linkUrl: e.target.value })}
      />
      <div className="row" style={{ gap: "var(--space-2)" }}>
        <button type="submit" className="btn btn-primary btn-sm" disabled={saveMut.isPending}>
          {t("projectPlan.save")}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>
          {t("projectPlan.cancel")}
        </button>
      </div>
      {saveMut.error instanceof Error && <div className="alert alert-error">{saveMut.error.message}</div>}
    </form>
  );

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 className="card-title">{t("projectPlan.tasksTitle")}</h2>
        <span className="muted">
          {t("projectPlan.tasksProgress", { done: progress.done, total: progress.total })}
        </span>
      </div>
      <div className="task-progress" aria-hidden="true">
        <div className="task-progress-bar" style={{ width: `${progress.percent}%` }} />
      </div>

      {tasks.length === 0 && editingId !== "new" && <p className="muted">{t("projectPlan.tasksEmpty")}</p>}

      <ul className="task-list">
        {tasks.map((task) =>
          editingId === task.id ? (
            <li key={task.id}>{form}</li>
          ) : (
            <li key={task.id} className={`task-item${task.done ? " task-item--done" : ""}`}>
              <input
                type="checkbox"
                checked={task.done}
                aria-label={t("projectPlan.markDone")}
                disabled={toggleMut.isPending}
                onChange={() => toggleMut.mutate(task)}
              />
              <div className="task-main">
                <span className="task-title">{task.title}</span>
                <span className="muted text-xs">
                  {task.assigneeName ?? ""}
                  {task.assigneeName && task.dueDate ? " · " : ""}
                  {task.dueDate && (
                    <span className={isOverdue(task, today) ? "task-overdue" : undefined}>
                      {t("projectPlan.taskDueOn", { date: fmtDay(task.dueDate) })}
                      {isOverdue(task, today) ? ` · ${t("projectPlan.taskOverdue")}` : ""}
                    </span>
                  )}
                </span>
              </div>
              {task.linkUrl && (
                <a href={task.linkUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">
                  ↗ {task.linkLabel}
                </a>
              )}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setDraft(toDraft(task));
                  setEditingId(task.id);
                }}
              >
                {t("projectPlan.edit")}
              </button>
              {canDelete && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    if (window.confirm(t("projectPlan.confirmDeleteTask"))) deleteMut.mutate(task.id);
                  }}
                >
                  {t("projectPlan.delete")}
                </button>
              )}
            </li>
          ),
        )}
        {editingId === "new" && <li>{form}</li>}
      </ul>

      {editingId === null && (
        <button
          type="button"
          className="btn btn-outline btn-sm"
          style={{ marginTop: "var(--space-3)" }}
          onClick={() => {
            setDraft(emptyDraft);
            setEditingId("new");
          }}
        >
          + {t("projectPlan.addTask")}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Styles**

An das Stylesheet anhängen, das `.card` definiert. Farben über die vorhandenen CSS-Variablen; die Namen vorher mit `grep -n "^\s*--color" apps/web/src/styles/*.css` prüfen und bei Abweichung ersetzen:

```css
/* Projektplan (Event-Detail, interne Ansicht) */
.project-plan-grid {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: var(--space-4);
  align-items: start;
}
.project-plan-side {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
@media (max-width: 900px) {
  .project-plan-grid {
    grid-template-columns: 1fr;
  }
}
.phase-bar {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.phase-step {
  flex: 1 1 120px;
  padding: var(--space-2);
  border-radius: 6px;
  border: none;
  font: inherit;
  text-align: center;
  background: var(--color-muted-bg, #e5e7eb);
  color: inherit;
}
.phase-step--done {
  background: var(--color-success, #16a34a);
  color: #fff;
}
.phase-step--current {
  background: var(--color-orange, #f97316);
  color: #fff;
  font-weight: 600;
}
.phase-step:enabled {
  cursor: pointer;
  outline: 1px dashed currentColor;
}
.task-progress {
  height: 6px;
  border-radius: 3px;
  background: var(--color-muted-bg, #e5e7eb);
  margin: var(--space-2) 0 var(--space-3);
}
.task-progress-bar {
  height: 6px;
  border-radius: 3px;
  background: var(--color-orange, #f97316);
}
.task-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.task-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--color-border, #e5e7eb);
}
.task-main {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.task-item--done .task-title {
  text-decoration: line-through;
  opacity: 0.6;
}
.task-overdue {
  color: var(--color-danger, #dc2626);
  font-weight: 600;
}
.task-form {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-2) 0;
}
```

- [ ] **Step 5: event-detail.tsx umbauen**

Imports ergänzen und `BudgetPanel` entfernen (die Datei `budget-panel.tsx` bleibt bestehen):

```tsx
import { BudgetLinkCard } from "../events/budget-link-card";
import { KeyFiguresCard } from "../events/key-figures-card";
import { PhaseBar } from "../events/phase-bar";
import { TaskChecklist } from "../events/task-checklist";
import { ToolsCard } from "../events/tools-card";
```

Den Block `{canManage && next.length > 0 && ( <div className="card"> … statusActions … </div> )}` komplett ersetzen durch:

```tsx
      {canManage && (
        <>
          <PhaseBar
            status={event.status}
            pending={transitionMut.isPending}
            onTransition={(status) => transitionMut.mutate(status)}
          />
          {transitionMut.error instanceof Error && (
            <div className="alert alert-error">{transitionMut.error.message}</div>
          )}
          <div className="project-plan-grid">
            <TaskChecklist eventId={event.id} />
            <div className="project-plan-side">
              <ToolsCard />
              <KeyFiguresCard event={event} />
              <BudgetLinkCard />
            </div>
          </div>
        </>
      )}
```

Die Zeile `<BudgetPanel event={event} />` löschen. `const next = allowedTransitions(event.status);` und den Import `allowedTransitions` entfernen, falls sie danach unbenutzt sind (Biome meldet das).

Hinweis: Den Projektplan direkt unter den Kopfbereich zu setzen, ist bewusst so gewählt. Die Stammdaten-Karte (Start, Ende, Ort …) bleibt an ihrer Stelle darunter.

- [ ] **Step 6: Typcheck, Lint, Tests**

Run: `pnpm typecheck && pnpm test && npx biome check apps/web/src/events apps/web/src/pages/event-detail.tsx`
Expected: keine Fehler (Warnungen `noDefaultExport` für Pages sind ok)

- [ ] **Step 7: Manuell prüfen**

Run: `pnpm dev`, dann im Browser ein Event öffnen (Dev-User ist Admin):
- Die Phasen-Leiste zeigt den richtigen Status. Ein Klick auf eine erlaubte Phase wechselt den Status.
- Eine Aufgabe anlegen, mit Fälligkeit gestern → sie wird als „überfällig“ rot angezeigt.
- Die Aufgabe abhaken → sie wird durchgestrichen, der Fortschrittsbalken wächst.
- Der Tools-Kasten zeigt Coworking-Copilot und Budget-Control-Agent, beide öffnen in einem neuen Tab.
- Statt des Budget-Bereichs erscheint der Budget-Link-Kasten.
- Bei Fensterbreite < 900 px stehen die Spalten untereinander.

- [ ] **Step 8: Commit**

```bash
npx biome format --write apps/web/src/events/phase-bar.tsx apps/web/src/events/key-figures-card.tsx apps/web/src/events/task-checklist.tsx apps/web/src/pages/event-detail.tsx apps/web/src/styles
git add apps/web/src/events/phase-bar.tsx apps/web/src/events/key-figures-card.tsx apps/web/src/events/task-checklist.tsx apps/web/src/pages/event-detail.tsx apps/web/src/styles
git commit -m "feat(event-detail): project plan view with phases, tasks, tools and budget link"
```

---

### Task 9: Aufgaben-Editor für Blueprints

**Files:**
- Create: `apps/web/src/admin/blueprint-tasks-modal.tsx`
- Modify: `apps/web/src/pages/blueprints.tsx` (Zustand + Button in der Zeilen-Aktion, Modal rendern)

**Interfaces:**
- Consumes: `BlueprintTaskDto` (Task 6), `GET/PUT /blueprints/:id/tasks` (Task 5)
- Produces: `<BlueprintTasksModal blueprintId name onClose />`

- [ ] **Step 1: Modal**

```tsx
// apps/web/src/admin/blueprint-tasks-modal.tsx
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../api/client";
import type { BlueprintTaskDto } from "../events/project-plan-types";

interface Row {
  id?: string;
  title: string;
  daysBefore: string;
  linkLabel: string;
  linkUrl: string;
}

function toRow(t: BlueprintTaskDto): Row {
  return {
    id: t.id,
    title: t.title,
    daysBefore: t.daysBefore === null ? "" : String(t.daysBefore),
    linkLabel: t.linkLabel ?? "",
    linkUrl: t.linkUrl ?? "",
  };
}

function toDto(r: Row): BlueprintTaskDto {
  const hasLink = r.linkLabel.trim() !== "" || r.linkUrl.trim() !== "";
  return {
    id: r.id,
    title: r.title.trim(),
    daysBefore: r.daysBefore === "" ? null : Number(r.daysBefore),
    linkLabel: hasLink ? r.linkLabel.trim() : null,
    linkUrl: hasLink ? r.linkUrl.trim() : null,
  };
}

interface Props {
  blueprintId: string;
  name: string;
  onClose: () => void;
}

export function BlueprintTasksModal({ blueprintId, name, onClose }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const key = ["blueprints", blueprintId, "tasks"];
  const q = useQuery({
    queryKey: key,
    queryFn: () => apiFetch<{ tasks: BlueprintTaskDto[] }>(`/blueprints/${blueprintId}/tasks`),
  });
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    if (q.data) setRows(q.data.tasks.map(toRow));
  }, [q.data]);

  const saveMut = useMutation({
    mutationFn: () =>
      apiFetch<{ tasks: BlueprintTaskDto[] }>(`/blueprints/${blueprintId}/tasks`, {
        method: "PUT",
        body: JSON.stringify({ tasks: rows.map(toDto) }),
      }),
    onSuccess: (data) => {
      qc.setQueryData(key, data);
      onClose();
    },
  });

  const update = (i: number, patch: Partial<Row>) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  return (
    <div className="modal-backdrop" onClick={onClose} onKeyDown={(e) => e.key === "Escape" && onClose()} role="presentation">
      <form
        className="modal"
        style={{ maxWidth: 900 }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          saveMut.mutate();
        }}
      >
        <h2 className="card-title">{t("projectPlan.blueprintTasksTitle", { name })}</h2>
        <p className="muted">{t("projectPlan.blueprintTasksHint")}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", marginTop: "var(--space-3)" }}>
          {rows.map((row, i) => (
            <div key={row.id ?? `new-${i}`} className="row" style={{ gap: "var(--space-2)" }}>
              <input className="input" style={{ flex: 2 }} required maxLength={200} placeholder={t("projectPlan.taskTitle")} aria-label={t("projectPlan.taskTitle")} value={row.title} onChange={(e) => update(i, { title: e.target.value })} />
              <input className="input" style={{ width: 90 }} type="number" min={0} max={365} placeholder={t("projectPlan.daysBefore")} aria-label={t("projectPlan.daysBefore")} value={row.daysBefore} onChange={(e) => update(i, { daysBefore: e.target.value })} />
              <input className="input" maxLength={100} placeholder={t("projectPlan.taskLinkLabel")} aria-label={t("projectPlan.taskLinkLabel")} value={row.linkLabel} onChange={(e) => update(i, { linkLabel: e.target.value })} />
              <input className="input" type="url" pattern="https://.*" maxLength={2000} placeholder={t("projectPlan.taskLinkUrl")} aria-label={t("projectPlan.taskLinkUrl")} value={row.linkUrl} onChange={(e) => update(i, { linkUrl: e.target.value })} />
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRows((r) => r.filter((_, idx) => idx !== i))}>
                {t("projectPlan.delete")}
              </button>
            </div>
          ))}
        </div>
        <button type="button" className="btn btn-outline btn-sm" style={{ marginTop: "var(--space-3)" }} onClick={() => setRows((r) => [...r, { title: "", daysBefore: "", linkLabel: "", linkUrl: "" }])}>
          + {t("projectPlan.addTask")}
        </button>
        {saveMut.error instanceof Error && (
          <div className="alert alert-error" style={{ marginTop: "var(--space-3)" }}>{saveMut.error.message}</div>
        )}
        <div className="row" style={{ gap: "var(--space-2)", marginTop: "var(--space-4)", justifyContent: "flex-end" }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>{t("projectPlan.cancel")}</button>
          <button type="submit" className="btn btn-primary" disabled={saveMut.isPending}>{t("projectPlan.save")}</button>
        </div>
      </form>
    </div>
  );
}
```

Vor dem Schreiben prüfen, wie das bestehende Apply-Modal in `blueprints.tsx` (~Z. 338–395) Backdrop, Klick und Tastatur behandelt, und dasselbe Muster übernehmen, damit Biome-a11y-Regeln identisch erfüllt sind.

- [ ] **Step 2: In blueprints.tsx einbinden**

```tsx
import { BlueprintTasksModal } from "../admin/blueprint-tasks-modal";
// im Komponenten-Body bei den anderen useState:
const [tasksFor, setTasksFor] = useState<{ id: string; name: string } | null>(null);
```

In der Zeilen-Aktion, innerhalb von `{canWrite && ( … )}` neben dem Apply-Button einen zweiten Button einfügen. Dafür `canWrite && (<button …apply…/>)` in ein Fragment umwandeln:

```tsx
                        {canWrite && (
                          <>
                            <button type="button" onClick={() => { setApplyFor(bp.id); setApplyTitle(bp.name); setApplyStart(""); }} className="btn btn-primary btn-sm">
                              {t("blueprints.apply")}
                            </button>
                            <button type="button" onClick={() => setTasksFor({ id: bp.id, name: bp.name })} className="btn btn-outline btn-sm">
                              {t("projectPlan.blueprintTasks")}
                            </button>
                          </>
                        )}
```

Am Ende des JSX, vor dem schließenden Wurzel-`</div>`:

```tsx
      {tasksFor && (
        <BlueprintTasksModal blueprintId={tasksFor.id} name={tasksFor.name} onClose={() => setTasksFor(null)} />
      )}
```

- [ ] **Step 3: Typcheck, Lint, Tests**

Run: `pnpm typecheck && pnpm test && npx biome check apps/web/src/admin apps/web/src/pages/blueprints.tsx`
Expected: keine Fehler

- [ ] **Step 4: Manuell prüfen**

Im Browser: Verwaltung → Vorlagen → „Aufgaben“ bei einer Vorlage, dann zwei Aufgaben eintragen (eine mit 30 Tagen und Coworking-Link, eine ohne Tage) und speichern. Danach „Anwenden“ mit einem Startdatum in 60 Tagen. Erwartet: Das neue Event zeigt beide Aufgaben, die erste ist 30 Tage vor dem Start fällig und hat den Button „↗ Coworking-Copilot“.

- [ ] **Step 5: Commit**

```bash
npx biome format --write apps/web/src/admin/blueprint-tasks-modal.tsx apps/web/src/pages/blueprints.tsx
git add apps/web/src/admin/blueprint-tasks-modal.tsx apps/web/src/pages/blueprints.tsx
git commit -m "feat(blueprints): edit task templates per blueprint"
```

---

### Task 10: Abschluss – Doku, Changelog, LF-Check

**Files:**
- Modify: `CHANGELOG.md` (Abschnitt „Unreleased“ → „Added“/„Changed“)
- Modify: `docs/api.md` (neue Endpunkte)

- [ ] **Step 1: CHANGELOG ergänzen**

```markdown
### Added
- Projektplan auf der Event-Detailseite (Team-Rollen): Phasen-Leiste, Aufgaben-Checkliste mit Verantwortlichen, Fälligkeit und Links, Tools-Kasten, Kennzahlen.
- Aufgaben-Vorlagen je Blueprint; werden beim Anlegen eines Events übernommen.
- Admin-Reiter „Tools“ für zentrale Links (vorbelegt: Coworking-Copilot, Budget-Control-Agent).

### Changed
- Budget-Bereich auf der Event-Seite durch Link zum Budget-Control-Agent ersetzt (keine Doppelerfassung).
- Werkstudent:innen können Vorlagen in der Oberfläche bearbeiten.
```

- [ ] **Step 2: docs/api.md ergänzen**

Die Endpunkt-Tabelle aus dem Spec-Abschnitt „API“ übernehmen, inklusive `GET /events/:eventId/task-assignees`, im selben Format wie die bestehenden Einträge in `docs/api.md`.

- [ ] **Step 3: LF-Check wie die CI**

```bash
TMP=$(mktemp -d) && git -c core.autocrlf=false clone -q C:/Projekte/mexp "$TMP/mexp" && cd "$TMP/mexp" && C:/Projekte/mexp/node_modules/.bin/biome check .
```

Expected: 0 Errors (die ~10 `noDefaultExport`-Warnungen sind ok)

- [ ] **Step 4: Commit**

```bash
git add CHANGELOG.md docs/api.md
git commit -m "docs: changelog and API docs for project plan"
```
