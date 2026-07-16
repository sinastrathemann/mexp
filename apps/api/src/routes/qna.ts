import { randomUUID } from "node:crypto";
/**
 * Q&A für Ausschreibungen
 * - Anbieter stellt Frage via Token (öffentlich)
 * - Veranstalter beantwortet (auth required)
 * - Alle Fragen + Antworten sind für alle Anbieter der gleichen Ausschreibung sichtbar
 * - Asker wird anonymisiert dargestellt ("Anbieter A", "Anbieter B" …) — Faire Bedingungen
 */
import { zValidator } from "@hono/zod-validator";
import { getHubUser } from "@mexp/auth";
import { Hono } from "hono";
import { z } from "zod";
import { persistentMap } from "../dev-persistence.js";
import { requireMexpRole } from "./_user-resolution.js";
import { devTenderStore } from "./tenders.js";
import { devVendorStore, vendorByToken } from "./vendors.js";

const MANAGE_ROLES = ["admin", "manager", "event_office", "werkstudent"] as const;

const askSchema = z.object({
  question: z.string().min(3).max(2000),
});
const answerSchema = z.object({
  answer: z.string().min(1).max(5000),
});

export interface DevQna {
  id: string;
  tenderId: string;
  askedByVendorId: string;
  question: string;
  askedAt: string;
  answer: string | null;
  answeredAt: string | null;
  answeredBy: string | null;
}

export const devQnaStore = persistentMap<DevQna>("qna");

export const qnaRoutes = new Hono();

function listForTender(tenderId: string) {
  return Array.from(devQnaStore.values())
    .filter((q) => q.tenderId === tenderId)
    .sort((a, b) => new Date(a.askedAt).getTime() - new Date(b.askedAt).getTime());
}

function anonymizeFor(items: DevQna[], viewerVendorId: string | null) {
  const vendorIdsInOrder = Array.from(new Set(items.map((q) => q.askedByVendorId)));
  const labelFor = (vendorId: string): string => {
    const idx = vendorIdsInOrder.indexOf(vendorId);
    return `Anbieter ${String.fromCharCode(65 + idx)}`;
  };
  return items.map((q) => ({
    id: q.id,
    question: q.question,
    askedAt: q.askedAt,
    answer: q.answer,
    answeredAt: q.answeredAt,
    askerLabel: viewerVendorId === q.askedByVendorId ? "Du" : labelFor(q.askedByVendorId),
    askerVendorId: null,
  }));
}

/**
 * Anbieter-Sicht via Token: anonymisierte Fragesteller-Labels
 *
 * Public: no Hub-auth required — the vendor-token IS the authentication.
 * Bypass configured via hubAuthMiddleware({publicPathPatterns:[...]}) in apps/api/src/index.ts.
 */
qnaRoutes.get("/tenders/:tenderId/qna", (c) => {
  const tenderId = c.req.param("tenderId");
  const tender = devTenderStore.get(tenderId);
  if (!tender) {
    return c.json({ error: { code: "NOT_FOUND", message: "Ausschreibung nicht gefunden" } }, 404);
  }
  const token = c.req.query("token");
  if (!token) {
    return c.json({ error: { code: "MISSING_TOKEN", message: "Token fehlt" } }, 400);
  }
  const vendor = vendorByToken(token);
  if (!vendor || vendor.tenderId !== tenderId) {
    return c.json({ error: { code: "INVALID_TOKEN", message: "Token ungültig" } }, 401);
  }
  const all = listForTender(tenderId);
  return c.json({ items: anonymizeFor(all, vendor.id) });
});

/**
 * Admin-Sicht: voller Firmenname + Vendor-ID
 */
qnaRoutes.get("/tenders/:tenderId/qna/admin", requireMexpRole(...MANAGE_ROLES), (c) => {
  const tenderId = c.req.param("tenderId");
  const tender = devTenderStore.get(tenderId);
  if (!tender) {
    return c.json({ error: { code: "NOT_FOUND", message: "Ausschreibung nicht gefunden" } }, 404);
  }
  const all = listForTender(tenderId);
  const items = all.map((q) => {
    const vendor = devVendorStore.get(q.askedByVendorId);
    return {
      id: q.id,
      question: q.question,
      askedAt: q.askedAt,
      answer: q.answer,
      answeredAt: q.answeredAt,
      askerLabel: vendor?.companyName ?? "Unbekannt",
      askerVendorId: q.askedByVendorId,
    };
  });
  return c.json({ items });
});

/**
 * Anbieter stellt eine Frage (via Token)
 *
 * Public: no Hub-auth required — the vendor-token IS the authentication.
 * Bypass configured via hubAuthMiddleware({publicPathPatterns:[...]}) in apps/api/src/index.ts.
 */
qnaRoutes.post("/tenders/:tenderId/qna", zValidator("json", askSchema), (c) => {
  const tenderId = c.req.param("tenderId");
  const token = c.req.query("token");
  if (!token) {
    return c.json({ error: { code: "MISSING_TOKEN", message: "Token fehlt" } }, 400);
  }
  const vendor = vendorByToken(token);
  if (!vendor || vendor.tenderId !== tenderId) {
    return c.json({ error: { code: "INVALID_TOKEN", message: "Token ungültig" } }, 401);
  }
  const tender = devTenderStore.get(tenderId);
  if (!tender || tender.status === "draft" || tender.status === "closed") {
    return c.json(
      {
        error: {
          code: "TENDER_NOT_OPEN",
          message: "Diese Ausschreibung nimmt aktuell keine Fragen entgegen.",
        },
      },
      409,
    );
  }
  const { question } = c.req.valid("json");
  const item: DevQna = {
    id: `qna-${randomUUID()}`,
    tenderId,
    askedByVendorId: vendor.id,
    question: question.trim(),
    askedAt: new Date().toISOString(),
    answer: null,
    answeredAt: null,
    answeredBy: null,
  };
  devQnaStore.set(item.id, item);
  return c.json({ item }, 201);
});

/**
 * Veranstalter beantwortet eine Frage
 */
qnaRoutes.post(
  "/tenders/:tenderId/qna/:qnaId/answer",
  requireMexpRole(...MANAGE_ROLES),
  zValidator("json", answerSchema),
  (c) => {
    const qnaId = c.req.param("qnaId");
    const existing = devQnaStore.get(qnaId);
    if (!existing) {
      return c.json({ error: { code: "NOT_FOUND", message: "Frage nicht gefunden" } }, 404);
    }
    const { answer } = c.req.valid("json");
    const actorId = getHubUser(c).id;
    devQnaStore.set(qnaId, {
      ...existing,
      answer: answer.trim(),
      answeredAt: new Date().toISOString(),
      answeredBy: actorId,
    });
    return c.json({ item: devQnaStore.get(qnaId) });
  },
);

/**
 * Antwort wieder zurücknehmen / löschen
 */
qnaRoutes.delete("/tenders/:tenderId/qna/:qnaId/answer", requireMexpRole(...MANAGE_ROLES), (c) => {
  const qnaId = c.req.param("qnaId");
  const existing = devQnaStore.get(qnaId);
  if (!existing) {
    return c.json({ error: { code: "NOT_FOUND", message: "Frage nicht gefunden" } }, 404);
  }
  devQnaStore.set(qnaId, {
    ...existing,
    answer: null,
    answeredAt: null,
    answeredBy: null,
  });
  return c.json({ ok: true });
});
