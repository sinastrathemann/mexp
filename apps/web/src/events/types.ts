export const EVENT_STATUSES = [
  "draft",
  "planned",
  "open",
  "running",
  "closed",
  "cancelled",
] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const EVENT_TYPES = [
  "mindsquare",
  "office",
  "feelgood",
  "team",
  "strategy",
  "division",
  "local_experience",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_VISIBILITIES = ["internal", "public"] as const;
export type EventVisibility = (typeof EVENT_VISIBILITIES)[number];

export interface EventDto {
  id: string;
  title: string;
  description: string;
  eventType: EventType;
  status: EventStatus;
  visibility: EventVisibility;
  startAt: string;
  endAt: string;
  location: string | null;
  // Zusatz-Infos zur Location: Adresse, Parkmöglichkeiten, Besonderheiten
  locationDetails?: string | null;
  capacity: number | null;
  // Anmeldung wird automatisch geschlossen ab diesem Datum
  registrationDeadline?: string | null;
  // Sichtbarkeits-Filter
  audienceScope?: "all" | "roles" | "emails";
  audienceRoles?: string[];
  audienceEmails?: string[];
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

// Admins können flexibel zwischen Status wechseln (Anmeldung öffnen, wieder schließen, Event starten/zurückziehen).
// Nur abgesagt/closed sind ohne weitere Aktionen finale Zustände, aber auch dort erlaubt wir Rückgang in den Vorzustand.
const TRANSITIONS: Record<EventStatus, readonly EventStatus[]> = {
  draft: ["planned", "open", "cancelled"],
  planned: ["draft", "open", "running", "cancelled"],
  open: ["draft", "planned", "running", "cancelled"],
  running: ["open", "closed", "cancelled"],
  closed: ["running"],
  cancelled: ["draft", "planned"],
};

export function allowedTransitions(status: EventStatus): readonly EventStatus[] {
  return TRANSITIONS[status];
}

export const PARTICIPATION_STATUSES = [
  "registered",
  "waitlisted",
  "cancelled",
  "attended",
  "no_show",
] as const;
export type ParticipationStatus = (typeof PARTICIPATION_STATUSES)[number];

export interface ParticipationDto {
  id: string;
  eventId: string;
  userId: string;
  status: ParticipationStatus;
  waitlistPosition: number | null;
  registeredAt: string;
  cancelledAt: string | null;
  checkedInAt: string | null;
  // Freitext-Notiz des Teilnehmers (z.B. "komme mit Partner")
  personalNote?: string | null;
}

export interface ParticipantDto extends ParticipationDto {
  userEmail: string;
  userDisplayName: string;
  answers?: RegistrationAnswer[];
}

// ─── Registrierungs-Formular pro Event ─────────────────────────
export const QUESTION_TYPES = [
  "yes_no",
  "single_choice",
  "multi_choice",
  "date_pick",
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export interface RegistrationQuestion {
  id: string;
  order: number;
  type: QuestionType;
  label: string;
  required: boolean;
  // Für single_choice/multi_choice: Antwort-Optionen
  // Für date_pick: ISO-Datums-Strings als Slots
  options: string[];
}

// Antwort kann sein: boolean (yes_no), string (single_choice),
// string[] (multi_choice / date_pick)
export type AnswerValue = boolean | string | string[] | null;

export interface RegistrationAnswer {
  questionId: string;
  value: AnswerValue;
}

export const BUDGET_CATEGORIES = [
  "venue",
  "catering",
  "material",
  "travel",
  "speaker_fee",
  "other",
] as const;
export type BudgetCategory = (typeof BUDGET_CATEGORIES)[number];

export const BUDGET_ITEM_STATUSES = ["draft", "submitted", "approved", "rejected"] as const;
export type BudgetItemStatus = (typeof BUDGET_ITEM_STATUSES)[number];

export const DOCUMENT_VISIBILITIES = ["event_staff", "participants", "public"] as const;
export type DocumentVisibility = (typeof DOCUMENT_VISIBILITIES)[number];

export interface DocumentDto {
  id: string;
  eventId: string;
  name: string;
  mimeType: string;
  fileSize: number;
  storageKey: string;
  visibility: DocumentVisibility;
  uploadedBy: string;
  uploadedAt: string;
}

export interface BudgetItemDto {
  id: string;
  eventId: string;
  category: BudgetCategory;
  description: string;
  plannedAmountCents: number;
  currency: string;
  status: BudgetItemStatus;
  taxNote: string | null;
  notes: string | null;
  createdBy: string;
  approverId: string | null;
  approvedAt: string | null;
  rejectedReason: string | null;
  // Tatsächliche Netto-Summe aus eingereichter Rechnung
  actualNetCents: number | null;
  invoiceFileName: string | null;
  invoiceUploadedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EventBlueprintDto {
  id: string;
  name: string;
  description: string;
  eventType: EventType;
  visibility: EventVisibility;
  defaultDurationMinutes: number;
  defaultCapacity: number | null;
  defaultLocation: string | null;
  defaultDescription: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface EventFeedbackDto {
  id: string;
  eventId: string;
  userId: string | null;
  ratingOverall: number;
  highlightText: string | null;
  improvementText: string | null;
  otherText: string | null;
  submittedAt: string;
}

export interface EventFeedbackStatsDto {
  count: number;
  averageOverall: number | null;
}

// ─── Ausschreibungen / Tender ─────────────────────────────────
export const TENDER_STATUSES = ["draft", "published", "closed", "awarded"] as const;
export type TenderStatus = (typeof TENDER_STATUSES)[number];

export interface TenderCriterion {
  label: string;
  weight: number;
}

export interface TenderDto {
  id: string;
  eventId: string;
  title: string;
  briefing: string;
  deadline: string | null;
  criteria: TenderCriterion[];
  status: TenderStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface VendorDto {
  id: string;
  tenderId: string;
  email: string;
  companyName: string;
  contactName: string;
  magicToken: string;
  invitedAt: string;
  lastAccessAt: string | null;
  revoked: boolean;
}
