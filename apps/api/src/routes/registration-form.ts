import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { env } from "../deps.js";
import { persistentMap } from "../dev-persistence.js";
import { requireMempRole } from "./_user-resolution.js";

// ─── Schemas ─────────────────────────────────────────────────────
const questionTypeSchema = z.enum(["yes_no", "single_choice", "multi_choice", "date_pick"]);

const questionSchema = z.object({
  id: z.string().min(1),
  order: z.number().int().min(0),
  type: questionTypeSchema,
  label: z.string().min(1).max(300),
  required: z.boolean(),
  options: z.array(z.string().min(1).max(200)).default([]),
});

const formSchema = z.object({
  questions: z.array(questionSchema).max(20),
});

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
      }),
    )
    .default([]),
});

// ─── In-Memory Stores (Dev-Mode) ────────────────────────────────
export interface DevRegistrationQuestion {
  id: string;
  order: number;
  type: "yes_no" | "single_choice" | "multi_choice" | "date_pick";
  label: string;
  required: boolean;
  options: string[];
}

// eventId → questions[]
export const devFormStore = persistentMap<DevRegistrationQuestion[]>("registration-forms");

// participationId → answers[]
export interface DevAnswer {
  questionId: string;
  value: boolean | string | string[] | null;
}
export const devAnswerStore = persistentMap<DevAnswer[]>("registration-answers");

// Live-Anmeldungen pro Event im Dev-Mode (eventId → DevLiveParticipant[])
export interface DevLiveParticipant {
  id: string;
  eventId: string;
  userId: string;
  userDisplayName: string;
  userEmail: string;
  status: "registered";
  waitlistPosition: null;
  registeredAt: string;
  checkedInAt: null;
  cancelledAt: null;
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
  for (const q of questions) {
    const a = byQ.get(q.id);
    const isAnswered =
      a !== undefined &&
      a.value !== null &&
      a.value !== "" &&
      !(Array.isArray(a.value) && a.value.length === 0);
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

// ─── Routes ─────────────────────────────────────────────────────
const MANAGE_ROLES = ["admin", "manager", "event_office", "werkstudent"] as const;

export const registrationFormRoutes = new Hono();

// GET: Alle eingeloggten User dürfen das Formular sehen (sonst können sie nicht antworten)
registrationFormRoutes.get("/events/:eventId/registration-form", async (c) => {
  const eventId = c.req.param("eventId");
  if (env.NODE_ENV !== "development") {
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
  requireMempRole(...MANAGE_ROLES),
  zValidator("json", formSchema),
  async (c) => {
    const eventId = c.req.param("eventId");
    const { questions } = c.req.valid("json");
    if (env.NODE_ENV !== "development") {
      return c.json({ error: { code: "NOT_IMPLEMENTED", message: "Dev-only" } }, 501);
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
