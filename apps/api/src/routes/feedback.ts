import { zValidator } from "@hono/zod-validator";
import {
  getOwnFeedback,
  listFeedback,
  submitFeedback,
  summarizeEventFeedback,
} from "@memp/application";
import { getHubUser } from "@memp/auth";
import { Hono } from "hono";
import { z } from "zod";
import { events, audit, env, feedback, llm } from "../deps.js";
import { persistentMap } from "../dev-persistence.js";
import { requireMempRole } from "./_user-resolution.js";

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

export const feedbackRoutes = new Hono();

feedbackRoutes.get("/events/:eventId/feedback", requireMempRole(...MANAGE_ROLES), async (c) => {
  const eventId = c.req.param("eventId");
  if (!env.DATABASE_URL) {
    const items = Array.from(devFeedbackStore.values()).filter((f) => f.eventId === eventId);
    const avg =
      items.length === 0 ? null : items.reduce((sum, f) => sum + f.ratingOverall, 0) / items.length;
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
  const userId = getHubUser(c).id;
  if (!env.DATABASE_URL) {
    const fb = devFeedbackStore.get(devKey(eventId, userId)) ?? null;
    return c.json({ feedback: fb });
  }
  const fb = await getOwnFeedback(eventId, userId, { events, feedback });
  return c.json({ feedback: fb });
});

feedbackRoutes.post(
  "/events/:eventId/feedback/summary",
  requireMempRole(...MANAGE_ROLES),
  async (c) => {
    const eventId = c.req.param("eventId");
    const result = await summarizeEventFeedback(eventId, { events, feedback, llm });
    return c.json(result);
  },
);

feedbackRoutes.post("/events/:eventId/feedback", zValidator("json", submitSchema), async (c) => {
  const eventId = c.req.param("eventId");
  const input = c.req.valid("json");
  const actorId = getHubUser(c).id;
  if (!env.DATABASE_URL) {
    const key = devKey(eventId, actorId);
    if (devFeedbackStore.has(key)) {
      return c.json(
        {
          error: {
            code: "FEEDBACK_ALREADY_SUBMITTED",
            message: "Du hast für dieses Event bereits Feedback abgegeben.",
          },
        },
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
