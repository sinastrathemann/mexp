import { zValidator } from "@hono/zod-validator";
import {
  getOwnFeedback,
  listFeedback,
  submitFeedback,
  summarizeEventFeedback,
} from "@memp/application";
import { type AuthVariables, requireAuth, requireRole } from "@memp/auth";
import { Hono } from "hono";
import { z } from "zod";
import { env, events, audit, feedback, llm } from "../deps.js";
import { persistentMap } from "../dev-persistence.js";

const ratingSchema = z.number().int().min(1).max(5);

const submitSchema = z.object({
  ratingOverall: ratingSchema,
  highlightText: z.string().max(5000).nullable().default(null),
  improvementText: z.string().max(5000).nullable().default(null),
  otherText: z.string().max(5000).nullable().default(null),
});

const MANAGE_ROLES = ["admin", "manager", "event_office", "werkstudent"] as const;

// Dev-Mode: In-Memory Feedback-Store (eventId + userId → feedback)
interface DevFeedback {
  id: string;
  eventId: string;
  userId: string;
  ratingOverall: number;
  highlightText: string | null;
  improvementText: string | null;
  otherText: string | null;
  submittedAt: string;
}
const devFeedbackStore = persistentMap<DevFeedback>("feedback");
const devKey = (eventId: string, userId: string) => `${eventId}::${userId}`;

export const feedbackRoutes = new Hono<{ Variables: AuthVariables }>();

feedbackRoutes.use("*", requireAuth());

feedbackRoutes.get("/events/:eventId/feedback", requireRole(...MANAGE_ROLES), async (c) => {
  const eventId = c.req.param("eventId");
  if (env.NODE_ENV === "development") {
    const items = Array.from(devFeedbackStore.values()).filter((f) => f.eventId === eventId);
    const avg =
      items.length === 0
        ? null
        : items.reduce((sum, f) => sum + f.ratingOverall, 0) / items.length;
    return c.json({
      feedback: items,
      stats: {
        count: items.length,
        averageOverall: avg,
      },
    });
  }
  const result = await listFeedback(eventId, { events, feedback });
  return c.json(result);
});

feedbackRoutes.get("/events/:eventId/feedback/mine", async (c) => {
  const eventId = c.req.param("eventId");
  const userId = c.get("auth").sub;
  if (env.NODE_ENV === "development") {
    const fb = devFeedbackStore.get(devKey(eventId, userId)) ?? null;
    return c.json({ feedback: fb });
  }
  const fb = await getOwnFeedback(eventId, userId, { events, feedback });
  return c.json({ feedback: fb });
});

feedbackRoutes.post(
  "/events/:eventId/feedback/summary",
  requireRole(...MANAGE_ROLES),
  async (c) => {
    const eventId = c.req.param("eventId");
    const result = await summarizeEventFeedback(eventId, { events, feedback, llm });
    return c.json(result);
  },
);

feedbackRoutes.post("/events/:eventId/feedback", zValidator("json", submitSchema), async (c) => {
  const eventId = c.req.param("eventId");
  const input = c.req.valid("json");
  const actorId = c.get("auth").sub;
  if (env.NODE_ENV === "development") {
    const key = devKey(eventId, actorId);
    if (devFeedbackStore.has(key)) {
      return c.json(
        { error: { code: "FEEDBACK_ALREADY_SUBMITTED", message: "Du hast für dieses Event bereits Feedback abgegeben." } },
        409,
      );
    }
    const fb: DevFeedback = {
      id: `fb-${Date.now()}`,
      eventId,
      userId: actorId,
      ratingOverall: input.ratingOverall,
      highlightText: input.highlightText,
      improvementText: input.improvementText,
      otherText: input.otherText,
      submittedAt: new Date().toISOString(),
    };
    devFeedbackStore.set(key, fb);
    return c.json({ feedback: fb }, 201);
  }
  const fb = await submitFeedback(
    {
      eventId,
      userId: actorId,
      ratingOverall: input.ratingOverall,
      // legacy fields — DB schema not yet migrated to new structure
      ratingContent: null,
      ratingOrganization: null,
      comment: input.highlightText ?? input.improvementText ?? input.otherText ?? null,
    },
    actorId,
    { events, feedback, audit },
  );
  return c.json({ feedback: fb }, 201);
});
