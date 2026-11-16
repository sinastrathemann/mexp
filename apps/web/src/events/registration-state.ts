import type { EventStatus, ParticipationStatus } from "./types";

export type RegistrationState = "open" | "closed_manual" | "closed_deadline" | "not_open";

/**
 * Ob sich Mitarbeitende gerade selbst anmelden können (Feedback-Runde 4):
 * nur in der Phase „Anmeldung offen“, nicht nach manuellem Schließen und nicht
 * nach Ablauf der Anmeldefrist.
 */
export function registrationState(
  event: {
    status: EventStatus;
    registrationClosed?: boolean | undefined;
    registrationDeadline?: string | null | undefined;
  },
  now: number = Date.now(),
): RegistrationState {
  if (event.status !== "open") return "not_open";
  if (event.registrationClosed === true) return "closed_manual";
  if (event.registrationDeadline) {
    const ms = new Date(event.registrationDeadline).getTime();
    if (Number.isFinite(ms) && ms < now) return "closed_deadline";
  }
  return "open";
}

/** „Nicht dabei“, „Abgemeldet“ und „Nicht erschienen“: zählen nicht als Teilnahme. */
export const INACTIVE_STATUSES: readonly ParticipationStatus[] = [
  "declined",
  "cancelled",
  "no_show",
];

export function isInactive(status: ParticipationStatus): boolean {
  return INACTIVE_STATUSES.includes(status);
}

/**
 * Teilnehmerliste fürs Event-Team: aktive Anmeldungen oben (Reihenfolge wie geliefert),
 * darunter nicht dabei → abgemeldet → nicht erschienen.
 */
export function orderParticipants<T extends { status: ParticipationStatus }>(list: T[]): T[] {
  const rank = (s: ParticipationStatus) => {
    const i = INACTIVE_STATUSES.indexOf(s);
    return i === -1 ? 0 : i + 1;
  };
  return list
    .map((p, i) => ({ p, i }))
    .sort((a, b) => rank(a.p.status) - rank(b.p.status) || a.i - b.i)
    .map(({ p }) => p);
}
