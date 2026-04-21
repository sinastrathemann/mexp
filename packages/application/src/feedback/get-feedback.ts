import type { EventFeedback, EventFeedbackStats } from "@memp/domain";
import { EventNotFoundError } from "@memp/domain";
import type { EventPort, FeedbackPort } from "../ports.js";

export interface GetFeedbackDeps {
  events: EventPort;
  feedback: FeedbackPort;
}

export async function listFeedback(
  eventId: string,
  deps: GetFeedbackDeps,
): Promise<{ feedback: EventFeedback[]; stats: EventFeedbackStats }> {
  const event = await deps.events.findById(eventId);
  if (!event) throw new EventNotFoundError(eventId);
  const [feedback, stats] = await Promise.all([
    deps.feedback.listForEvent(eventId),
    deps.feedback.statsForEvent(eventId),
  ]);
  return { feedback, stats };
}

export async function getOwnFeedback(
  eventId: string,
  userId: string,
  deps: GetFeedbackDeps,
): Promise<EventFeedback | null> {
  const event = await deps.events.findById(eventId);
  if (!event) throw new EventNotFoundError(eventId);
  return deps.feedback.findByEventAndUser(eventId, userId);
}
