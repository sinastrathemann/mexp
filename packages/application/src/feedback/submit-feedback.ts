import type { EventFeedback } from "@memp/domain";
import {
  EventNotFoundError,
  FeedbackAlreadySubmittedError,
  FeedbackNotAvailableError,
  FeedbackRatingInvalidError,
} from "@memp/domain";
import { rootLogger } from "@memp/shared";
import type { AuditPort, EventPort, FeedbackPort } from "../ports.js";

export interface SubmitFeedbackDeps {
  events: EventPort;
  feedback: FeedbackPort;
  audit: AuditPort;
}

export interface SubmitFeedbackInput {
  eventId: string;
  userId: string;
  ratingOverall: number;
  ratingContent?: number | null;
  ratingOrganization?: number | null;
  comment?: string | null;
}

function validRating(n: number | null | undefined): boolean {
  if (n === null || n === undefined) return true;
  return Number.isInteger(n) && n >= 1 && n <= 5;
}

export async function submitFeedback(
  input: SubmitFeedbackInput,
  actorId: string,
  deps: SubmitFeedbackDeps,
): Promise<EventFeedback> {
  const log = rootLogger.child({
    module: "submit-feedback",
    eventId: input.eventId,
    userId: input.userId,
    actorId,
  });

  if (
    !validRating(input.ratingOverall) ||
    !validRating(input.ratingContent ?? null) ||
    !validRating(input.ratingOrganization ?? null)
  ) {
    throw new FeedbackRatingInvalidError();
  }

  const event = await deps.events.findById(input.eventId);
  if (!event) throw new EventNotFoundError(input.eventId);

  if (event.status !== "running" && event.status !== "closed") {
    throw new FeedbackNotAvailableError(event.status);
  }

  const existing = await deps.feedback.findByEventAndUser(input.eventId, input.userId);
  if (existing) throw new FeedbackAlreadySubmittedError();

  const fb = await deps.feedback.create({
    eventId: input.eventId,
    userId: input.userId,
    ratingOverall: input.ratingOverall,
    ratingContent: input.ratingContent ?? null,
    ratingOrganization: input.ratingOrganization ?? null,
    comment: input.comment ?? null,
  });

  await deps.audit.record({
    entityType: "feedback",
    entityId: fb.id,
    action: "feedback.submitted",
    actorId,
    after: {
      eventId: fb.eventId,
      ratingOverall: fb.ratingOverall,
      ratingContent: fb.ratingContent,
      ratingOrganization: fb.ratingOrganization,
      hasComment: Boolean(fb.comment),
    },
    context: { eventId: input.eventId },
  });

  log.info({ feedbackId: fb.id }, "feedback submitted");
  return fb;
}
