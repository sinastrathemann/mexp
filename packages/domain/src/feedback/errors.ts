import { MexpError } from "@mexp/shared";

export class FeedbackRatingInvalidError extends MexpError {
  constructor() {
    super("FEEDBACK_RATING_INVALID", "Bewertung muss zwischen 1 und 5 liegen", 400);
  }
}

export class FeedbackNotAvailableError extends MexpError {
  constructor(eventStatus: string) {
    super(
      "FEEDBACK_NOT_AVAILABLE",
      `Feedback ist für dieses Event nicht möglich (Status: ${eventStatus})`,
      409,
      { eventStatus },
    );
  }
}

export class FeedbackAlreadySubmittedError extends MexpError {
  constructor() {
    super("FEEDBACK_ALREADY_SUBMITTED", "Feedback wurde bereits abgegeben", 409);
  }
}
