import { randomUUID } from "node:crypto";
import { devFormStore } from "../routes/registration-form.js";
import { type EventTask, eventPlanMetaStore, eventTaskStore } from "./model.js";

/**
 * Feedback-Runde 6 (Punkt 15): Beim Duplizieren eines Events auch Anmeldeformular,
 * Aufgaben und Planungsdaten übernehmen. Das Quell-Event wird nur gelesen.
 * Nicht kopiert: Anmeldungen/Antworten, Teilnehmende, Dokumente, Audit.
 */
export function copyEventExtras(sourceId: string, targetId: string, actorId: string): void {
  const now = new Date().toISOString();

  const questions = devFormStore.get(sourceId);
  if (questions?.length) {
    devFormStore.set(
      targetId,
      questions.map((q) => ({ ...q, id: randomUUID() })),
    );
  }

  const tasks = eventTaskStore.get(sourceId);
  if (tasks?.length) {
    eventTaskStore.set(
      targetId,
      tasks.map(
        (t): EventTask => ({
          ...t,
          id: randomUUID(),
          dueDate: null,
          startDate: null,
          done: false,
          doneBy: null,
          doneAt: null,
          createdBy: actorId,
          createdAt: now,
        }),
      ),
    );
  }

  const meta = eventPlanMetaStore.get(sourceId);
  if (meta) {
    eventPlanMetaStore.set(targetId, {
      ...meta,
      goalReached: null,
      alternativeDate: null,
      updatedBy: actorId,
      updatedAt: now,
    });
  }
}
