import { randomUUID } from "node:crypto";
/**
 * Ausschreibungs-Modul (Tender / RFP)
 * - Ein Event kann eine Ausschreibung haben
 * - Anbieter werden via Magic-Link eingeladen
 * - Q&A zwischen Anbietern + Veranstalter (Antworten public)
 * - Angebote (PDF) werden hochgeladen
 * - Optional KI-Bewertung (Phase B)
 */
import { zValidator } from "@hono/zod-validator";
import { getHubUser } from "@mexp/auth";
import { Hono } from "hono";
import { z } from "zod";
import { env } from "../deps.js";
import { persistentMap } from "../dev-persistence.js";
import { requireMexpRole } from "./_user-resolution.js";

const MANAGE_ROLES = ["admin", "manager", "event_office", "werkstudent"] as const;

// ─── Schemas ─────────────────────────────────────────────────────
const criterionSchema = z.object({
  label: z.string().min(1).max(120),
  weight: z.number().min(0).max(100),
});

const createTenderSchema = z.object({
  eventId: z.string().min(1),
  title: z.string().min(1).max(200),
  briefing: z.string().max(20000).default(""),
  deadline: z.string().datetime({ offset: true }).nullable().default(null),
  criteria: z.array(criterionSchema).max(20).default([]),
});

const updateTenderSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    briefing: z.string().max(20000).optional(),
    deadline: z.string().datetime({ offset: true }).nullable().optional(),
    criteria: z.array(criterionSchema).max(20).optional(),
    status: z.enum(["draft", "published", "closed", "awarded"]).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Mindestens ein Feld" });

// ─── In-Memory Store ─────────────────────────────────────────────
export interface DevTender {
  id: string;
  eventId: string;
  title: string;
  briefing: string;
  deadline: string | null;
  criteria: { label: string; weight: number }[];
  status: "draft" | "published" | "closed" | "awarded";
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export const devTenderStore = persistentMap<DevTender>("tenders");

export const tenderRoutes = new Hono();

// Liste aller Ausschreibungen — Filter nach eventId optional
tenderRoutes.get("/", requireMexpRole(...MANAGE_ROLES), (c) => {
  const eventId = c.req.query("eventId");
  const all = Array.from(devTenderStore.values());
  const filtered = eventId ? all.filter((t) => t.eventId === eventId) : all;
  return c.json({
    tenders: filtered.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    ),
  });
});

// Ausschreibung lesen (Admin-Sicht)
tenderRoutes.get("/:id", requireMexpRole(...MANAGE_ROLES), (c) => {
  const id = c.req.param("id");
  const t = devTenderStore.get(id);
  if (!t)
    return c.json({ error: { code: "NOT_FOUND", message: "Ausschreibung nicht gefunden" } }, 404);
  return c.json({ tender: t });
});

// Ausschreibung anlegen
tenderRoutes.post(
  "/",
  requireMexpRole(...MANAGE_ROLES),
  zValidator("json", createTenderSchema),
  (c) => {
    if (env.DATABASE_URL) {
      return c.json({ error: { code: "NOT_IMPLEMENTED", message: "Dev-only" } }, 501);
    }
    const input = c.req.valid("json");
    const actorId = getHubUser(c).id;
    const now = new Date().toISOString();
    const tender: DevTender = {
      id: `tdr-${randomUUID()}`,
      eventId: input.eventId,
      title: input.title,
      briefing: input.briefing,
      deadline: input.deadline,
      criteria: input.criteria,
      status: "draft",
      createdAt: now,
      updatedAt: now,
      createdBy: actorId,
    };
    devTenderStore.set(tender.id, tender);
    return c.json({ tender }, 201);
  },
);

// Ausschreibung bearbeiten
tenderRoutes.patch(
  "/:id",
  requireMexpRole(...MANAGE_ROLES),
  zValidator("json", updateTenderSchema),
  (c) => {
    const id = c.req.param("id");
    const input = c.req.valid("json");
    const existing = devTenderStore.get(id);
    if (!existing) {
      return c.json({ error: { code: "NOT_FOUND", message: "Nicht gefunden" } }, 404);
    }
    const next: DevTender = {
      ...existing,
      ...(input.title !== undefined && { title: input.title }),
      ...(input.briefing !== undefined && { briefing: input.briefing }),
      ...(input.deadline !== undefined && { deadline: input.deadline }),
      ...(input.criteria !== undefined && { criteria: input.criteria }),
      ...(input.status !== undefined && { status: input.status }),
      updatedAt: new Date().toISOString(),
    };
    devTenderStore.set(id, next);
    return c.json({ tender: next });
  },
);

// Ausschreibung löschen — nur Admin
tenderRoutes.delete("/:id", requireMexpRole("admin"), (c) => {
  const id = c.req.param("id");
  if (!devTenderStore.has(id)) {
    return c.json({ error: { code: "NOT_FOUND", message: "Nicht gefunden" } }, 404);
  }
  devTenderStore.delete(id);
  return c.json({ ok: true });
});
