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
import { events, audit, budgets } from "../deps.js";

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

const OWNER_ROLES = ["admin", "manager", "event_office", "budget_owner"] as const;
const APPROVER_ROLES = ["admin", "manager", "budget_owner"] as const;

export const budgetRoutes = new Hono<{ Variables: AuthVariables }>();

budgetRoutes.use("*", requireAuth());

budgetRoutes.get("/events/:eventId/budget", requireRole(...OWNER_ROLES), async (c) => {
  const eventId = c.req.param("eventId");
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

budgetRoutes.post("/budget/:id/submit", requireRole(...OWNER_ROLES), async (c) => {
  const id = c.req.param("id");
  const actorId = c.get("auth").sub;
  const item = await submitBudgetItem(id, actorId, { budgets, audit });
  return c.json({ item });
});

budgetRoutes.post("/budget/:id/approve", requireRole(...APPROVER_ROLES), async (c) => {
  const id = c.req.param("id");
  const actorId = c.get("auth").sub;
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
    const item = await rejectBudgetItem(id, reason, actorId, { budgets, audit });
    return c.json({ item });
  },
);

budgetRoutes.post("/budget/:id/reopen", requireRole(...OWNER_ROLES), async (c) => {
  const id = c.req.param("id");
  const actorId = c.get("auth").sub;
  const item = await reopenBudgetItem(id, actorId, { budgets, audit });
  return c.json({ item });
});
