import { randomBytes, randomUUID } from "node:crypto";
/**
 * Anbieter-Verwaltung für Ausschreibungen (Vendor / Magic-Link)
 * - Admin lädt einen Anbieter ein → Magic-Token wird erzeugt
 * - Anbieter öffnet die Landingpage mit ?token=... → kann Ausschreibung lesen, Fragen stellen, Angebot einreichen
 * - Kein Account nötig — Token validiert die Identität
 */
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { env } from "../deps.js";
import { persistentMap } from "../dev-persistence.js";
import { requireMempRole } from "./_user-resolution.js";
import { devTenderStore } from "./tenders.js";

const MANAGE_ROLES = ["admin", "manager", "event_office", "werkstudent"] as const;

// ─── Schemas ─────────────────────────────────────────────────────
const inviteSchema = z.object({
  tenderId: z.string().min(1),
  email: z.string().email(),
  companyName: z.string().min(1).max(200),
  contactName: z.string().max(200).default(""),
});

// ─── Store ───────────────────────────────────────────────────────
export interface DevVendor {
  id: string;
  tenderId: string;
  email: string;
  companyName: string;
  contactName: string;
  magicToken: string;
  invitedAt: string;
  lastAccessAt: string | null;
  revoked: boolean;
}

export const devVendorStore = persistentMap<DevVendor>("vendors");

// Hilfsfunktion: Vendor anhand Token finden
export function vendorByToken(token: string): DevVendor | null {
  for (const v of devVendorStore.values()) {
    if (v.magicToken === token && !v.revoked) return v;
  }
  return null;
}

export const vendorRoutes = new Hono();

// ─── Admin-Endpoints (auth required) ─────────────────────────────
const adminRoutes = new Hono();

// Anbieter einladen
adminRoutes.post(
  "/invite",
  requireMempRole(...MANAGE_ROLES),
  zValidator("json", inviteSchema),
  (c) => {
    if (env.NODE_ENV !== "development") {
      return c.json({ error: { code: "NOT_IMPLEMENTED", message: "Dev-only" } }, 501);
    }
    const input = c.req.valid("json");
    const tender = devTenderStore.get(input.tenderId);
    if (!tender) {
      return c.json(
        { error: { code: "TENDER_NOT_FOUND", message: "Ausschreibung nicht gefunden" } },
        404,
      );
    }
    // Duplikat-Check: gleiche Email + Tender
    for (const v of devVendorStore.values()) {
      if (
        v.tenderId === input.tenderId &&
        v.email.toLowerCase() === input.email.toLowerCase() &&
        !v.revoked
      ) {
        return c.json(
          {
            error: {
              code: "VENDOR_EXISTS",
              message: "Anbieter ist bereits für diese Ausschreibung eingeladen.",
            },
          },
          409,
        );
      }
    }
    const vendor: DevVendor = {
      id: `ven-${randomUUID()}`,
      tenderId: input.tenderId,
      email: input.email.toLowerCase(),
      companyName: input.companyName,
      contactName: input.contactName,
      magicToken: randomBytes(24).toString("base64url"),
      invitedAt: new Date().toISOString(),
      lastAccessAt: null,
      revoked: false,
    };
    devVendorStore.set(vendor.id, vendor);
    return c.json(
      {
        vendor,
        magicLink: `/vendor?token=${vendor.magicToken}`,
      },
      201,
    );
  },
);

// Liste Anbieter pro Tender
adminRoutes.get("/", requireMempRole(...MANAGE_ROLES), (c) => {
  const tenderId = c.req.query("tenderId");
  if (!tenderId) {
    return c.json({ error: { code: "MISSING_PARAM", message: "tenderId erforderlich" } }, 400);
  }
  const list = Array.from(devVendorStore.values())
    .filter((v) => v.tenderId === tenderId)
    .sort((a, b) => new Date(b.invitedAt).getTime() - new Date(a.invitedAt).getTime());
  return c.json({ vendors: list });
});

// Anbieter widerrufen (Token ungültig machen)
adminRoutes.post("/:id/revoke", requireMempRole(...MANAGE_ROLES), (c) => {
  const id = c.req.param("id");
  const v = devVendorStore.get(id);
  if (!v) return c.json({ error: { code: "NOT_FOUND", message: "Nicht gefunden" } }, 404);
  devVendorStore.set(id, { ...v, revoked: true });
  return c.json({ ok: true });
});

vendorRoutes.route("/admin", adminRoutes);

// ─── Public Vendor-Access via Token ──────────────────────────────
// Public: no Hub-auth required — the vendor-token IS the authentication.
// Bypass configured via hubAuthMiddleware({publicPathPatterns:[...]}) in apps/api/src/index.ts.
vendorRoutes.get("/session", (c) => {
  const token = c.req.query("token");
  if (!token) {
    return c.json({ error: { code: "MISSING_TOKEN", message: "Token fehlt" } }, 400);
  }
  const vendor = vendorByToken(token);
  if (!vendor) {
    return c.json(
      { error: { code: "INVALID_TOKEN", message: "Ungültiger oder widerrufener Token" } },
      401,
    );
  }
  // Letzten Zugriff tracken
  devVendorStore.set(vendor.id, { ...vendor, lastAccessAt: new Date().toISOString() });

  const tender = devTenderStore.get(vendor.tenderId);
  if (!tender || tender.status === "draft") {
    return c.json(
      {
        error: {
          code: "TENDER_NOT_AVAILABLE",
          message: "Die Ausschreibung ist aktuell nicht freigegeben.",
        },
      },
      404,
    );
  }
  return c.json({
    vendor: {
      id: vendor.id,
      email: vendor.email,
      companyName: vendor.companyName,
      contactName: vendor.contactName,
    },
    tender,
  });
});
// touch to restart
