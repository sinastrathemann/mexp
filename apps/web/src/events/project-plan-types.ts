// Spiegel der API-Typen aus apps/api/src/project-plan/model.ts
export const TASK_PRIORITIES = ["high", "medium", "low"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export interface EventTaskDto {
  id: string;
  title: string;
  dueDate: string | null;
  // „ab"-Datum (Runde 6); API liefert null, wenn nicht gesetzt
  startDate: string | null;
  // API ergänzt "medium", wenn eine (ältere) Aufgabe keine Priorität gespeichert hat
  priority: TaskPriority;
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

export interface BlueprintTaskDto {
  id?: string;
  title: string;
  daysBefore: number | null;
  linkLabel: string | null;
  linkUrl: string | null;
}

export interface ToolLinkDto {
  id?: string;
  label: string;
  url: string;
}

export interface AssigneeDto {
  id: string;
  displayName: string;
}

// GET/PUT /events/:id/plan-meta — nur für das Event-Team (EXM)
export interface EventPlanMetaDto extends PlanningFieldsValue {
  responsibleId: string | null;
  responsibleName: string | null;
  exmNote: string | null;
}

// --- Feedback-Runde 5: Event/Projekt + Planungsfelder (nur EXM) ---
export const EVENT_KINDS = ["event", "project"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];
export const RECURRENCES = ["N", "W", "R", "V"] as const;
export type Recurrence = (typeof RECURRENCES)[number];
export const GOAL_RESULTS = ["missed", "reached", "exceeded"] as const;
export type GoalReached = (typeof GOAL_RESULTS)[number];

export interface PlanningFieldsValue {
  kind: EventKind;
  targetCount: string | null;
  targetCategories: number[];
  recurrence: Recurrence | null;
  goalReached: GoalReached | null;
  alternativeDate: string | null;
}

export const EMPTY_PLANNING: PlanningFieldsValue = {
  kind: "event",
  targetCount: null,
  targetCategories: [],
  recurrence: null,
  goalReached: null,
  alternativeDate: null,
};

// --- Contentplan ---
export const CONTENT_CHANNELS = [
  "general",
  "mail",
  "teams",
  "outlook",
  "communities",
  "location",
  "other",
] as const;
export type ContentChannel = (typeof CONTENT_CHANNELS)[number];

export interface ContentPlanEntryDto {
  id: string;
  date: string;
  title: string;
  channel: ContentChannel;
  responsibleId: string | null;
  responsibleName: string | null;
  eventId: string | null;
  /** Freitext, wenn das Event noch nicht in mEXP angelegt ist */
  eventName: string | null;
  note: string | null;
}

// --- Jahresplanung ---
export interface YearPlanInternalDto extends PlanningFieldsValue {
  id: string;
  title: string;
  date: string | null;
  endDate: string | null;
  status: string | null;
  ownerId: string | null;
  archived: boolean;
  responsibleId: string | null;
  responsibleName: string | null;
}
export interface YearPlanManualDto {
  id: string;
  kind: "external" | "school_holiday";
  title: string;
  date: string;
  endDate: string | null;
}
export interface YearPlanDto {
  year: number;
  internal: YearPlanInternalDto[];
  manual: YearPlanManualDto[];
  holidays: { date: string; title: string }[];
}
