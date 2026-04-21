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
import { events, audit, feedback, llm } from "../deps.js";

const ratingSchema = z.number().int().min(1).max(5);

const submitSchema = z.object({
  ratingOverall: ratingSchema,
  ratingContent: ratingSchema.nullable().default(null),
  ratingOrganization: ratingSchema.nullable().default(null),
  comment: z.string().max(5000).nullable().default(null),
});

const MANAGE_ROLES = ["admin", "manager", "event_office"] as const;

export const feedbackRoutes = new Hono<{ Variables: AuthVariables }>();

feedbackRoutes.use("*", requireAuth());

feedbackRoutes.get("/events/:eventId/feedback", requireRole(...MANAGE_ROLES), async (c) => {
  const eventId = c.req.param("eventId");
  const result = await listFeedback(eventId, { events, feedback });
  return c.json(result);
});

feedbackRoutes.get("/events/:eventId/feedback/mine", async (c) => {
  const eventId = c.req.param("eventId");
  const userId = c.get("auth").sub;
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
  const fb = await submitFeedback(
    {
      eventId,
      userId: actorId,
      ratingOverall: input.ratingOverall,
      ratingContent: input.ratingContent,
      ratingOrganization: input.ratingOrganization,
      comment: input.comment,
    },
    actorId,
    { events, feedback, audit },
  );
  return c.json({ feedback: fb }, 201);
});
