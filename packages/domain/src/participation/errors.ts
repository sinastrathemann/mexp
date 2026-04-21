import { MempError } from "@memp/shared";
import type { EventStatus } from "../event/status.js";

export class AlreadyRegisteredError extends MempError {
  constructor(eventId: string, userId: string) {
    super("ALREADY_REGISTERED", "Bereits für dieses Event angemeldet", 409, { eventId, userId });
  }
}

export class RegistrationNotOpenError extends MempError {
  constructor(eventStatus: EventStatus) {
    super(
      "REGISTRATION_NOT_OPEN",
      `Anmeldung nicht möglich: Event ist im Status '${eventStatus}'`,
      409,
      { eventStatus },
    );
  }
}

export class ParticipationNotFoundError extends MempError {
  constructor(eventId: string, userId: string) {
    super("PARTICIPATION_NOT_FOUND", "Keine Anmeldung gefunden", 404, { eventId, userId });
  }
}

export class NoWaitlistEntryError extends MempError {
  constructor(eventId: string) {
    super("NO_WAITLIST_ENTRY", "Keine Personen auf der Warteliste", 404, { eventId });
  }
}

export class CheckInNotAllowedError extends MempError {
  constructor(eventStatus: EventStatus) {
    super(
      "CHECKIN_NOT_ALLOWED",
      `Check-in nicht möglich: Event ist im Status '${eventStatus}'`,
      409,
      { eventStatus },
    );
  }
}

export class ParticipationStatusInvalidError extends MempError {
  constructor(currentStatus: string, requiredStatus: string) {
    super(
      "PARTICIPATION_STATUS_INVALID",
      `Aktion benötigt Teilnehmer-Status '${requiredStatus}', aktueller Status ist '${currentStatus}'`,
      409,
      { currentStatus, requiredStatus },
    );
  }
}
