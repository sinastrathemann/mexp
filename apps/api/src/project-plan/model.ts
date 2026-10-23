/**
 * Projektplan je Event (Spec docs/mindCoder/specs/2026-10-23-projektplan-design.md):
 * Aufgaben pro Event, Aufgaben-Vorlagen pro Blueprint und die zentrale Tools-Liste.
 * Datei-basiert wie Event-Anfragen (persistentMap) — kein Audit-Log, daher tragen
 * die Datensätze selbst, wer was wann angelegt bzw. abgehakt hat.
 */
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { persistentMap } from "../dev-persistence.js";

export const TEAM_ROLES = ["admin", "manager", "event_office", "werkstudent"] as const;

export interface EventTask {
  id: string;
  title: string;
  dueDate: string | null; // YYYY-MM-DD
  assigneeId: string | null;
  assigneeName: string | null;
  linkLabel: string | null;
  linkUrl: string | null;
  done: boolean;
  doneBy: string | null;
  doneAt: string | null;
  createdBy: string;
  createdAt: string;
}

export interface BlueprintTask {
  id: string;
  title: string;
  daysBefore: number | null;
  linkLabel: string | null;
  linkUrl: string | null;
}

export interface ToolLink {
  id: string;
  label: string;
  url: string;
}

export interface ToolList {
  tools: ToolLink[];
  updatedBy: string;
  updatedAt: string;
}

export const eventTaskStore = persistentMap<EventTask[]>("event-tasks");
export const blueprintTaskStore = persistentMap<BlueprintTask[]>("blueprint-tasks");
export const toolStore = persistentMap<ToolList>("tools");

// Nur https: verhindert javascript:-Links und unverschlüsselte Ziele.
export const httpsUrlSchema = z
  .string()
  .trim()
  .max(2000)
  .url()
  .refine((u) => u.startsWith("https://"), { message: "Nur https-Links erlaubt." });
export const linkLabelSchema = z.string().trim().min(1).max(100);
export const taskTitleSchema = z.string().trim().min(1).max(200);

export const DEFAULT_TOOLS: ToolLink[] = [
  {
    id: "coworking-copilot",
    label: "Coworking-Copilot",
    url: "https://personal-hub.mindsquare.de/coworking-copilot/",
  },
  {
    id: "budget-control-agent",
    label: "Budget-Control-Agent",
    url: "https://personal-hub.mindsquare.de/budget-control-agent/",
  },
];

/** Gespeicherte Liste — oder die Vorbelegung, solange der Admin nie gespeichert hat. */
export function getTools(): ToolLink[] {
  return toolStore.get("default")?.tools ?? DEFAULT_TOOLS;
}

/** Fälligkeit = Event-Start minus N Tage, als Kalenderdatum (UTC). */
export function computeDueDate(startAtIso: string, daysBefore: number | null): string | null {
  if (daysBefore === null) return null;
  const due = new Date(new Date(startAtIso).getTime() - daysBefore * 86_400_000);
  return due.toISOString().slice(0, 10);
}

/** Kopiert die Aufgaben eines Blueprints in ein neu angelegtes Event. */
export function copyBlueprintTasksToEvent(
  blueprintId: string,
  eventId: string,
  eventStartAtIso: string,
  actorId: string,
): EventTask[] {
  const templates = blueprintTaskStore.get(blueprintId) ?? [];
  if (templates.length === 0) return [];
  const now = new Date().toISOString();
  const copied: EventTask[] = templates.map((t) => ({
    id: randomUUID(),
    title: t.title,
    dueDate: computeDueDate(eventStartAtIso, t.daysBefore),
    assigneeId: null,
    assigneeName: null,
    linkLabel: t.linkLabel,
    linkUrl: t.linkUrl,
    done: false,
    doneBy: null,
    doneAt: null,
    createdBy: actorId,
    createdAt: now,
  }));
  eventTaskStore.set(eventId, [...(eventTaskStore.get(eventId) ?? []), ...copied]);
  return copied;
}
