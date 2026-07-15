import { zValidator } from "@hono/zod-validator";
import {
  approveBudgetItem,
  createBudgetItem,
  listBudgetItems,
  rejectBudgetItem,
  reopenBudgetItem,
  submitBudgetItem,
  updateBudgetItem,
} from "@memp/application";
import { type AuthVariables, requireAuth, requireRole } from "@memp/auth";
import { BUDGET_CATEGORIES } from "@memp/domain";
import { Hono } from "hono";
import { z } from "zod";
import { env, events, audit, budgets } from "../deps.js";
import { persistentMap } from "../dev-persistence.js";
import { extractText, getDocumentProxy } from "unpdf";

const categorySchema = z.enum(BUDGET_CATEGORIES);

const createSchema = z.object({
  category: categorySchema,
  description: z.string().min(1).max(500),
  plannedAmountCents: z.number().int().min(0),
  currency: z.string().length(3).default("EUR"),
  taxNote: z.string().max(1000).nullable().default(null),
  notes: z.string().max(2000).nullable().default(null),
});

const updateSchema = z
  .object({
    category: categorySchema.optional(),
    description: z.string().min(1).max(500).optional(),
    plannedAmountCents: z.number().int().min(0).optional(),
    currency: z.string().length(3).optional(),
    taxNote: z.string().max(1000).nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Mindestens ein Feld muss gesetzt sein" });

const rejectSchema = z.object({ reason: z.string().min(1).max(1000) });

// Dev-Mode: Rechnungs-Upload + Netto-Ist
const invoiceSchema = z.object({
  actualNetCents: z.number().int().min(0),
  invoiceFileName: z.string().min(1).max(255),
});

const OWNER_ROLES = ["admin", "manager", "event_office", "budget_owner"] as const;
const APPROVER_ROLES = ["admin", "manager", "budget_owner"] as const;

// ─── Dev-Mode In-Memory Store ──────────────────────────────────
interface DevBudgetItem {
  id: string;
  eventId: string;
  category: string;
  description: string;
  plannedAmountCents: number;
  currency: string;
  status: "draft" | "submitted" | "approved" | "rejected";
  taxNote: string | null;
  notes: string | null;
  createdBy: string;
  approverId: string | null;
  approvedAt: string | null;
  rejectedReason: string | null;
  actualNetCents: number | null;
  invoiceFileName: string | null;
  invoiceUploadedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
export const devBudgetStore = persistentMap<DevBudgetItem>("budget");

// Mutation im Item + Persist auslösen
function touchBudget(item: DevBudgetItem): DevBudgetItem {
  devBudgetStore.set(item.id, item);
  return item;
}
export type { DevBudgetItem };

export const budgetRoutes = new Hono<{ Variables: AuthVariables }>();

budgetRoutes.use("*", requireAuth());

budgetRoutes.get("/events/:eventId/budget", requireRole(...OWNER_ROLES), async (c) => {
  const eventId = c.req.param("eventId");
  if (env.NODE_ENV === "development") {
    const items = Array.from(devBudgetStore.values()).filter((b) => b.eventId === eventId);
    return c.json({ items });
  }
  const items = await listBudgetItems(eventId, { events, budgets });
  return c.json({ items });
});

budgetRoutes.post(
  "/events/:eventId/budget",
  requireRole(...OWNER_ROLES),
  zValidator("json", createSchema),
  async (c) => {
    const eventId = c.req.param("eventId");
    const input = c.req.valid("json");
    const actorId = c.get("auth").sub;
    if (env.NODE_ENV === "development") {
      const now = new Date().toISOString();
      const item: DevBudgetItem = {
        id: `bg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        eventId,
        category: input.category,
        description: input.description,
        plannedAmountCents: input.plannedAmountCents,
        currency: input.currency,
        status: "draft",
        taxNote: input.taxNote,
        notes: input.notes,
        createdBy: actorId,
        approverId: null,
        approvedAt: null,
        rejectedReason: null,
        actualNetCents: null,
        invoiceFileName: null,
        invoiceUploadedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      devBudgetStore.set(item.id, item);
      return c.json({ item }, 201);
    }
    const item = await createBudgetItem(
      {
        eventId,
        category: input.category,
        description: input.description,
        plannedAmountCents: input.plannedAmountCents,
        currency: input.currency,
        taxNote: input.taxNote,
        notes: input.notes,
      },
      actorId,
      { events, budgets, audit },
    );
    return c.json({ item }, 201);
  },
);

budgetRoutes.patch(
  "/budget/:id",
  requireRole(...OWNER_ROLES),
  zValidator("json", updateSchema),
  async (c) => {
    const id = c.req.param("id");
    const input = c.req.valid("json");
    const actorId = c.get("auth").sub;
    if (env.NODE_ENV === "development") {
      const item = devBudgetStore.get(id);
      if (!item)
        return c.json({ error: { code: "NOT_FOUND", message: "Position nicht gefunden" } }, 404);
      if (input.category !== undefined) item.category = input.category;
      if (input.description !== undefined) item.description = input.description;
      if (input.plannedAmountCents !== undefined) item.plannedAmountCents = input.plannedAmountCents;
      if (input.currency !== undefined) item.currency = input.currency;
      if (input.taxNote !== undefined) item.taxNote = input.taxNote;
      if (input.notes !== undefined) item.notes = input.notes;
      item.updatedAt = new Date().toISOString();
      touchBudget(item);
      return c.json({ item });
    }
    const patch: Parameters<typeof updateBudgetItem>[1] = {};
    if (input.category !== undefined) patch.category = input.category;
    if (input.description !== undefined) patch.description = input.description;
    if (input.plannedAmountCents !== undefined) patch.plannedAmountCents = input.plannedAmountCents;
    if (input.currency !== undefined) patch.currency = input.currency;
    if (input.taxNote !== undefined) patch.taxNote = input.taxNote;
    if (input.notes !== undefined) patch.notes = input.notes;
    const item = await updateBudgetItem(id, patch, actorId, { budgets, audit });
    return c.json({ item });
  },
);

// NEW: PDF hochladen + Netto automatisch extrahieren (Yokoy-light)
budgetRoutes.post("/budget/:id/invoice/upload", requireRole(...OWNER_ROLES), async (c) => {
  const id = c.req.param("id");
  if (env.NODE_ENV !== "development") {
    return c.json({ error: { code: "NOT_IMPLEMENTED", message: "Dev-only" } }, 501);
  }

  const item = devBudgetStore.get(id);
  if (!item)
    return c.json({ error: { code: "NOT_FOUND", message: "Position nicht gefunden" } }, 404);

  let formData: FormData;
  try {
    formData = await c.req.formData();
  } catch {
    return c.json(
      { error: { code: "INVALID_BODY", message: "Erwarte multipart/form-data" } },
      400,
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return c.json({ error: { code: "NO_FILE", message: "Keine Datei übermittelt" } }, 400);
  }
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return c.json(
      { error: { code: "INVALID_TYPE", message: "Nur PDF wird unterstützt" } },
      400,
    );
  }

  let extractedText = "";
  try {
    const buffer = new Uint8Array(await file.arrayBuffer());
    const pdf = await getDocumentProxy(buffer);
    const result = await extractText(pdf, { mergePages: true });
    extractedText = Array.isArray(result.text) ? result.text.join("\n") : String(result.text);
  } catch (err) {
    return c.json(
      {
        error: {
          code: "PDF_PARSE_FAILED",
          message: `PDF konnte nicht gelesen werden: ${(err as Error).message}`,
        },
      },
      422,
    );
  }

  const extraction = extractInvoiceData(extractedText);

  // Datei nur als Metadatum + Größe behalten (kein echter Storage in Dev)
  item.invoiceFileName = file.name;
  item.invoiceUploadedAt = new Date().toISOString();
  if (extraction.netCents !== null) {
    item.actualNetCents = extraction.netCents;
  }
  item.updatedAt = item.invoiceUploadedAt;
  touchBudget(item);

  return c.json({
    item,
    extraction: {
      netCents: extraction.netCents,
      grossCents: extraction.grossCents,
      vatPercent: extraction.vatPercent,
      confidence: extraction.confidence,
      reasoning: extraction.reasoning,
    },
  });
});

// ─── Heuristik-Extraktion ──────────────────────────────────────
function parseGermanNumber(raw: string): number | null {
  // "1.234,56" oder "1234,56" oder "1234.56" → 123456 cents
  const cleaned = raw.replace(/\s/g, "");
  // Format mit Komma als Dezimaltrenner (DE)
  if (/^\d{1,3}(\.\d{3})*,\d{2}$/.test(cleaned) || /^\d+,\d{2}$/.test(cleaned)) {
    const normalized = cleaned.replace(/\./g, "").replace(",", ".");
    const n = Number.parseFloat(normalized);
    return Number.isFinite(n) ? Math.round(n * 100) : null;
  }
  // Format mit Punkt als Dezimaltrenner (EN)
  if (/^\d{1,3}(,\d{3})*\.\d{2}$/.test(cleaned) || /^\d+\.\d{2}$/.test(cleaned)) {
    const normalized = cleaned.replace(/,/g, "");
    const n = Number.parseFloat(normalized);
    return Number.isFinite(n) ? Math.round(n * 100) : null;
  }
  return null;
}

interface ExtractionResult {
  netCents: number | null;
  grossCents: number | null;
  vatPercent: number | null;
  confidence: "high" | "medium" | "low" | "none";
  reasoning: string;
}

function extractInvoiceData(text: string): ExtractionResult {
  const normalized = text.replace(/ /g, " ");
  // Suche nach Mustern wie "Netto: 1.234,56 €", "Summe netto 1.234,56", "Zwischensumme: 1.234,56"
  const amountPattern = "(\\d{1,3}(?:[\\.,]\\d{3})*[\\.,]\\d{2})";
  const currencyPattern = "(?:\\s*€|\\s*EUR)?";

  const netPatterns: RegExp[] = [
    new RegExp(`(?:Summe\\s+netto|Nettosumme|Netto[-\\s]?betrag|Netto[\\s:]+|Zwischensumme)[\\s:€EUR]*${amountPattern}${currencyPattern}`, "gi"),
    new RegExp(`${amountPattern}\\s*€?\\s*(?:Netto|netto)`, "gi"),
  ];
  const grossPatterns: RegExp[] = [
    new RegExp(`(?:Gesamtbetrag|Brutto[-\\s]?betrag|Bruttosumme|Rechnungs[-\\s]?betrag|Endbetrag|Summe\\s+brutto)[\\s:€EUR]*${amountPattern}${currencyPattern}`, "gi"),
    new RegExp(`${amountPattern}\\s*€?\\s*(?:Brutto|brutto)`, "gi"),
  ];
  const vatPattern = /(?:MwSt|USt|Umsatzsteuer|Mehrwertsteuer)[\s:.]*(\d{1,2})\s?%/i;

  const findFirst = (patterns: RegExp[]): number | null => {
    for (const pat of patterns) {
      pat.lastIndex = 0;
      const m = pat.exec(normalized);
      if (m && m[1]) {
        const parsed = parseGermanNumber(m[1]);
        if (parsed !== null) return parsed;
      }
    }
    return null;
  };

  const netCents = findFirst(netPatterns);
  const grossCents = findFirst(grossPatterns);
  const vatMatch = vatPattern.exec(normalized);
  const vatPercent = vatMatch ? Number.parseInt(vatMatch[1] ?? "", 10) : null;

  let confidence: ExtractionResult["confidence"] = "none";
  const reasons: string[] = [];

  if (netCents !== null) {
    confidence = "high";
    reasons.push(`Netto-Wert direkt gefunden: ${(netCents / 100).toFixed(2)} €`);
  } else if (grossCents !== null && vatPercent !== null) {
    // Netto aus Brutto + MwSt rückrechnen
    const computed = Math.round(grossCents / (1 + vatPercent / 100));
    confidence = "medium";
    reasons.push(
      `Netto aus Brutto (${(grossCents / 100).toFixed(2)} €) und MwSt-Satz ${vatPercent}% berechnet`,
    );
    return {
      netCents: computed,
      grossCents,
      vatPercent,
      confidence,
      reasoning: reasons.join(" · "),
    };
  } else if (grossCents !== null) {
    // Nur Brutto, MwSt unbekannt → 19% annehmen
    const computed = Math.round(grossCents / 1.19);
    confidence = "low";
    reasons.push(
      `Nur Brutto (${(grossCents / 100).toFixed(2)} €) gefunden, 19% MwSt angenommen`,
    );
    return {
      netCents: computed,
      grossCents,
      vatPercent: 19,
      confidence,
      reasoning: reasons.join(" · "),
    };
  } else {
    reasons.push("Keine Beträge im PDF erkannt — bitte manuell eintragen");
  }

  return {
    netCents,
    grossCents,
    vatPercent,
    confidence,
    reasoning: reasons.join(" · "),
  };
}

// NEW: Rechnung & Netto-Ist eintragen
budgetRoutes.post(
  "/budget/:id/invoice",
  requireRole(...OWNER_ROLES),
  zValidator("json", invoiceSchema),
  async (c) => {
    const id = c.req.param("id");
    const input = c.req.valid("json");
    if (env.NODE_ENV === "development") {
      const item = devBudgetStore.get(id);
      if (!item)
        return c.json({ error: { code: "NOT_FOUND", message: "Position nicht gefunden" } }, 404);
      item.actualNetCents = input.actualNetCents;
      item.invoiceFileName = input.invoiceFileName;
      item.invoiceUploadedAt = new Date().toISOString();
      item.updatedAt = item.invoiceUploadedAt;
      touchBudget(item);
      return c.json({ item });
    }
    return c.json({ error: { code: "NOT_IMPLEMENTED", message: "Invoice-Upload nur im Dev-Mode" } }, 501);
  },
);

budgetRoutes.delete("/budget/:id/invoice", requireRole(...OWNER_ROLES), async (c) => {
  const id = c.req.param("id");
  if (env.NODE_ENV === "development") {
    const item = devBudgetStore.get(id);
    if (!item)
      return c.json({ error: { code: "NOT_FOUND", message: "Position nicht gefunden" } }, 404);
    item.actualNetCents = null;
    item.invoiceFileName = null;
    item.invoiceUploadedAt = null;
    item.updatedAt = new Date().toISOString();
    touchBudget(item);
    return c.json({ item });
  }
  return c.json({ error: { code: "NOT_IMPLEMENTED", message: "Dev-only" } }, 501);
});

budgetRoutes.post("/budget/:id/submit", requireRole(...OWNER_ROLES), async (c) => {
  const id = c.req.param("id");
  const actorId = c.get("auth").sub;
  if (env.NODE_ENV === "development") {
    const item = devBudgetStore.get(id);
    if (!item) return c.json({ error: { code: "NOT_FOUND", message: "Nicht gefunden" } }, 404);
    item.status = "submitted";
    item.updatedAt = new Date().toISOString();
    touchBudget(item);
    return c.json({ item });
  }
  const item = await submitBudgetItem(id, actorId, { budgets, audit });
  return c.json({ item });
});

budgetRoutes.post("/budget/:id/approve", requireRole(...APPROVER_ROLES), async (c) => {
  const id = c.req.param("id");
  const actorId = c.get("auth").sub;
  if (env.NODE_ENV === "development") {
    const item = devBudgetStore.get(id);
    if (!item) return c.json({ error: { code: "NOT_FOUND", message: "Nicht gefunden" } }, 404);
    item.status = "approved";
    item.approverId = actorId;
    item.approvedAt = new Date().toISOString();
    item.rejectedReason = null;
    item.updatedAt = item.approvedAt;
    touchBudget(item);
    return c.json({ item });
  }
  const item = await approveBudgetItem(id, actorId, { budgets, audit });
  return c.json({ item });
});

budgetRoutes.post(
  "/budget/:id/reject",
  requireRole(...APPROVER_ROLES),
  zValidator("json", rejectSchema),
  async (c) => {
    const id = c.req.param("id");
    const { reason } = c.req.valid("json");
    const actorId = c.get("auth").sub;
    if (env.NODE_ENV === "development") {
      const item = devBudgetStore.get(id);
      if (!item) return c.json({ error: { code: "NOT_FOUND", message: "Nicht gefunden" } }, 404);
      item.status = "rejected";
      item.rejectedReason = reason;
      item.approverId = actorId;
      item.updatedAt = new Date().toISOString();
      touchBudget(item);
      return c.json({ item });
    }
    const item = await rejectBudgetItem(id, reason, actorId, { budgets, audit });
    return c.json({ item });
  },
);

budgetRoutes.post("/budget/:id/reopen", requireRole(...OWNER_ROLES), async (c) => {
  const id = c.req.param("id");
  const actorId = c.get("auth").sub;
  if (env.NODE_ENV === "development") {
    const item = devBudgetStore.get(id);
    if (!item) return c.json({ error: { code: "NOT_FOUND", message: "Nicht gefunden" } }, 404);
    item.status = "draft";
    item.rejectedReason = null;
    item.approverId = null;
    item.approvedAt = null;
    item.updatedAt = new Date().toISOString();
    touchBudget(item);
    return c.json({ item });
  }
  const item = await reopenBudgetItem(id, actorId, { budgets, audit });
  return c.json({ item });
});
