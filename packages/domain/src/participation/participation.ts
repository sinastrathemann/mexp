export const PARTICIPATION_STATUSES = [
  "registered",
  "waitlisted",
  "cancelled",
  "attended",
  "no_show",
] as const;
export type ParticipationStatus = (typeof PARTICIPATION_STATUSES)[number];

export function isParticipationStatus(value: unknown): value is ParticipationStatus {
  return typeof value === "string" && (PARTICIPATION_STATUSES as readonly string[]).includes(value);
}

export interface Participation {
  id: string;
  eventId: string;
  userId: string;
  status: ParticipationStatus;
  waitlistPosition: number | null;
  registeredAt: Date;
  cancelledAt: Date | null;
  checkedInAt: Date | null;
}

export interface ParticipationWithUser extends Participation {
  userEmail: string;
  userDisplayName: string;
}
