import { EventNotFoundError } from "@mexp/domain";
import type { EventPort, FeedbackPort, LlmPort } from "../ports.js";

export interface SummarizeFeedbackDeps {
  events: EventPort;
  feedback: FeedbackPort;
  llm: LlmPort;
}

export interface FeedbackSummaryResult {
  eventId: string;
  count: number;
  summary: string;
  provider: string;
  model: string;
}

const SYSTEM_PROMPT = `Du bist ein Feedback-Analyst für interne Events der mindsquare AG.
Fasse eingegangenes Teilnehmerfeedback in 3-5 Bulletpoints zusammen.
Fokus: Wiederkehrende Stärken, konkrete Verbesserungsvorschläge, auffällige Einzelmeinungen.
Keine personenbezogenen Daten nennen. Antworte auf Deutsch.`;

export async function summarizeEventFeedback(
  eventId: string,
  deps: SummarizeFeedbackDeps,
): Promise<FeedbackSummaryResult> {
  const event = await deps.events.findById(eventId);
  if (!event) throw new EventNotFoundError(eventId);

  const feedback = await deps.feedback.listForEvent(eventId);
  if (feedback.length === 0) {
    return {
      eventId,
      count: 0,
      summary: "Noch kein Feedback vorhanden.",
      provider: "none",
      model: "none",
    };
  }

  const context = feedback
    .map((fb, i) => {
      const parts = [`Antwort ${i + 1}`, `Gesamt: ${fb.ratingOverall}/5`];
      if (fb.ratingContent !== null) parts.push(`Inhalt: ${fb.ratingContent}/5`);
      if (fb.ratingOrganization !== null) parts.push(`Organisation: ${fb.ratingOrganization}/5`);
      if (fb.comment) parts.push(`Kommentar: ${fb.comment}`);
      return parts.join(" · ");
    })
    .join("\n");

  const result = await deps.llm.summarize({
    purpose: "feedback_summary",
    prompt: SYSTEM_PROMPT,
    context,
  });

  return {
    eventId,
    count: feedback.length,
    summary: result.summary,
    provider: result.provider,
    model: result.model,
  };
}
