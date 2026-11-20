import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { env } from "../deps.js";
import { persistentMap } from "../dev-persistence.js";
import { requireMexpRole } from "./_user-resolution.js";

// ─── Schemas ─────────────────────────────────────────────────────
const questionTypeSchema = z.enum([
  "yes_no",
  "single_choice",
  "multi_choice",
  "date_pick",
  "free_text",
]);

const questionSchema = z.object({
  id: z.string().min(1),
  order: z.number().int().min(0),
  type: questionTypeSchema,
  label: z.string().min(1).max(300),
  required: z.boolean(),
  options: z.array(z.string().min(1).max(200)).default([]),
  // Einfach-/Mehrfachauswahl: zusätzliche Auswahl "Andere" mit Freitext
  allowOther: z.boolean().optional(),
  // Ja/Nein-Frage entscheidet über die Teilnahme: "Nein" = nicht dabei
  attendance: z.boolean().optional(),
  // Antworten sehen auch Teilnehmende ohne Schreibrolle (Abstimmung mit Namen)
  answersPublic: z.boolean().optional(),
  // Runde 6: Folgefrage — nur sichtbar, wenn eine frühere Frage passend beantwortet ist
  showIf: z
    .object({ questionId: z.string().min(1), equals: z.union([z.boolean(), z.string().max(200)]) })
    .optional(),
});

const formSchema = z.object({
  questions: z.array(questionSchema).max(20),
});

export const OTHER_TEXT_MAX = 200;

const answerValueSchema: z.ZodType<boolean | string | string[] | null> = z.union([
  z.boolean(),
  z.string().max(2000),
  z.array(z.string().max(2000)).max(50),
  z.null(),
]);

const answersSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        value: answerValueSchema,
        otherText: z.string().max(OTHER_TEXT_MAX).nullable().optional(),
      }),
    )
    .default([]),
});

// ─── In-Memory Stores (Dev-Mode) ────────────────────────────────
export interface DevRegistrationQuestion {
  id: string;
  order: number;
  type: "yes_no" | "single_choice" | "multi_choice" | "date_pick" | "free_text";
  label: string;
  required: boolean;
  options: string[];
  allowOther?: boolean | undefined;
  attendance?: boolean | undefined;
  answersPublic?: boolean | undefined;
  showIf?: { questionId: string; equals: boolean | string } | undefined;
}

/**
 * Runde 6: IDs der aktuell sichtbaren Fragen. Eine Folgefrage ist sichtbar, wenn ihre
 * auslösende Frage (weiter oben) sichtbar ist und die Antwort passt — Ja/Nein und
 * Einfachauswahl: gleicher Wert, Mehrfachauswahl: Wert ist mit ausgewählt.
 * Fragen ohne showIf sind immer sichtbar.
 */
export function visibleQuestionIds(
  questions: DevRegistrationQuestion[],
  answers: Pick<DevAnswer, "questionId" | "value">[],
): Set<string> {
  const byQ = new Map(answers.map((a) => [a.questionId, a.value]));
  const visible = new Set<string>();
  for (const q of [...questions].sort((a, b) => a.order - b.order)) {
    const cond = q.showIf;
    if (!cond) {
      visible.add(q.id);
      continue;
    }
    if (!visible.has(cond.questionId)) continue;
    const value = byQ.get(cond.questionId);
    const match = Array.isArray(value)
      ? value.includes(String(cond.equals))
      : value === cond.equals;
    if (match) visible.add(q.id);
  }
  return visible;
}

// Formulare von vor dem Teilnahme-Häkchen: die Vorlage "Bist du dabei?" gilt weiter als Teilnahme-Frage
export function isAttendanceQuestion(q: DevRegistrationQuestion): boolean {
  if (q.type !== "yes_no") return false;
  return q.attendance ?? q.label.trim() === "Bist du dabei?";
}

// true, wenn eine Teilnahme-Frage mit "Nein" beantwortet wurde
export function declinesAttendance(
  questions: DevRegistrationQuestion[],
  answers: DevAnswer[],
): boolean {
  const byQ = new Map(answers.map((a) => [a.questionId, a.value]));
  return questions.some((q) => isAttendanceQuestion(q) && byQ.get(q.id) === false);
}

// eventId → questions[]
export const devFormStore = persistentMap<DevRegistrationQuestion[]>("registration-forms");

// participationId → answers[]
export interface DevAnswer {
  questionId: string;
  value: boolean | string | string[] | null;
  // Freitext zur Auswahl "Andere" (nur bei allowOther)
  otherText?: string | null | undefined;
}
export const devAnswerStore = persistentMap<DevAnswer[]>("registration-answers");

// Live-Anmeldungen pro Event im Dev-Mode (eventId → DevLiveParticipant[])
export interface DevLiveParticipant {
  id: string;
  eventId: string;
  userId: string;
  userDisplayName: string;
  userEmail: string;
  // Nach Anlage immer "registered" — check-in/no-show/promote-waitlist verändern den
  // Status über den participation-override-Store (siehe events.ts), nicht hier direkt.
  // "declined": Teilnahme-Frage mit "Nein" beantwortet — angemeldet, aber nicht dabei
  status: "registered" | "waitlisted" | "attended" | "no_show" | "cancelled" | "declined";
  waitlistPosition: number | null;
  registeredAt: string;
  checkedInAt: string | null;
  cancelledAt: string | null;
  // Freitext-Notiz vom User selbst (z.B. "komme mit Partner") — editierbar
  personalNote?: string | null;
}
export const devLiveParticipantsStore = persistentMap<DevLiveParticipant[]>("live-participants");

// Hilfsfunktion: Validierung Antworten gegen Schema
export function validateAnswers(
  questions: DevRegistrationQuestion[],
  answers: DevAnswer[],
): { ok: true } | { ok: false; message: string } {
  const byQ = new Map(answers.map((a) => [a.questionId, a]));
  // "Nicht dabei": weitere Pflichtfragen (z. B. Stadt-Abstimmung) entfallen
  const visible = visibleQuestionIds(questions, answers);
  const relevant = (
    declinesAttendance(questions, answers) ? questions.filter(isAttendanceQuestion) : questions
  ).filter((q) => visible.has(q.id));
  for (const q of relevant) {
    const a = byQ.get(q.id);
    const otherText = a?.otherText?.trim() ?? "";
    const hasValue =
      a !== undefined &&
      a.value !== null &&
      a.value !== "" &&
      !(Array.isArray(a.value) && a.value.length === 0);
    const isAnswered = hasValue || otherText !== "";
    if (otherText !== "") {
      const choice = q.type === "single_choice" || q.type === "multi_choice";
      if (!choice || !q.allowOther) {
        return { ok: false, message: `"${q.label}": "Andere" ist hier nicht vorgesehen` };
      }
      if (otherText.length > OTHER_TEXT_MAX) {
        return {
          ok: false,
          message: `"${q.label}": Text bei "Andere" ist zu lang (max. ${OTHER_TEXT_MAX} Zeichen)`,
        };
      }
    }
    if (q.required && !isAnswered) {
      return { ok: false, message: `Pflichtfrage nicht beantwortet: "${q.label}"` };
    }
    if (!a) continue;

    // Typcheck
    if (q.type === "yes_no") {
      if (typeof a.value !== "boolean" && a.value !== null) {
        return { ok: false, message: `"${q.label}": Erwarte Ja/Nein` };
      }
    } else if (q.type === "single_choice") {
      if (a.value !== null && typeof a.value !== "string") {
        return { ok: false, message: `"${q.label}": Erwarte eine Auswahl` };
      }
      if (typeof a.value === "string" && !q.options.includes(a.value)) {
        return { ok: false, message: `"${q.label}": Ungültige Option` };
      }
    } else if (q.type === "free_text") {
      if (a.value !== null && typeof a.value !== "string") {
        return { ok: false, message: `"${q.label}": Erwarte einen Text` };
      }
      if (typeof a.value === "string" && a.value.length > 2000) {
        return { ok: false, message: `"${q.label}": Text ist zu lang (max. 2000 Zeichen)` };
      }
    } else if (q.type === "multi_choice" || q.type === "date_pick") {
      if (a.value !== null && !Array.isArray(a.value)) {
        return { ok: false, message: `"${q.label}": Erwarte eine Liste` };
      }
      if (Array.isArray(a.value)) {
        for (const v of a.value) {
          if (!q.options.includes(v)) {
            return { ok: false, message: `"${q.label}": Ungültige Option "${v}"` };
          }
        }
      }
    }
  }
  return { ok: true };
}

// Freitext "Andere" getrimmt speichern, leere Texte weglassen.
// Mit Formular: Antworten auf ausgeblendete Folgefragen verwerfen (Runde 6).
export function normalizeAnswers(
  answers: DevAnswer[],
  questions?: DevRegistrationQuestion[],
): DevAnswer[] {
  const visible = questions ? visibleQuestionIds(questions, answers) : null;
  const kept = visible
    ? answers.filter((a) => {
        const q = questions?.find((x) => x.id === a.questionId);
        return !q?.showIf || visible.has(a.questionId);
      })
    : answers;
  return kept.map(({ otherText, ...rest }) => {
    const trimmed = otherText?.trim() ?? "";
    return trimmed === "" ? rest : { ...rest, otherText: trimmed };
  });
}

// ─── Routes ─────────────────────────────────────────────────────
const MANAGE_ROLES = ["admin", "manager", "event_office", "werkstudent"] as const;

export const registrationFormRoutes = new Hono();

// GET: Alle eingeloggten User dürfen das Formular sehen (sonst können sie nicht antworten)
registrationFormRoutes.get("/events/:eventId/registration-form", async (c) => {
  const eventId = c.req.param("eventId");
  if (env.DATABASE_URL) {
    return c.json({ questions: [] });
  }
  const questions = devFormStore.get(eventId) ?? [];
  // sortiert nach order
  return c.json({
    questions: [...questions].sort((a, b) => a.order - b.order),
  });
});

// PUT: Nur Admins/Manager/Event-Office dürfen das Formular bearbeiten
registrationFormRoutes.put(
  "/events/:eventId/registration-form",
  requireMexpRole(...MANAGE_ROLES),
  zValidator("json", formSchema),
  async (c) => {
    const eventId = c.req.param("eventId");
    const { questions } = c.req.valid("json");
    if (env.DATABASE_URL) {
      return c.json({ error: { code: "NOT_IMPLEMENTED", message: "Dev-only" } }, 501);
    }
    // Folgefragen: Auslöser muss weiter oben stehen und Ja/Nein oder Auswahl sein
    for (const q of questions) {
      if (!q.showIf) continue;
      const trigger = questions.find((x) => x.id === q.showIf?.questionId);
      const okType =
        trigger?.type === "yes_no" ||
        trigger?.type === "single_choice" ||
        trigger?.type === "multi_choice";
      if (!trigger || !okType || trigger.order >= q.order) {
        return c.json(
          {
            error: {
              code: "INVALID_QUESTION",
              message: `"${q.label}": Folgefrage braucht eine Ja/Nein- oder Auswahl-Frage weiter oben`,
            },
          },
          400,
        );
      }
    }
    // Validierung: bei choice/date_pick muss mind. eine Option vorhanden sein
    for (const q of questions) {
      if (
        (q.type === "single_choice" || q.type === "multi_choice" || q.type === "date_pick") &&
        q.options.length === 0
      ) {
        return c.json(
          {
            error: {
              code: "INVALID_QUESTION",
              message: `"${q.label}": Mindestens eine Option erforderlich`,
            },
          },
          400,
        );
      }
    }
    devFormStore.set(eventId, questions);
    return c.json({ questions });
  },
);

export { answersSchema };
