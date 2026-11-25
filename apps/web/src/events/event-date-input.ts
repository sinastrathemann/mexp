// Eingabe des Event-Termins (Runde 7, Punkte 20/21): Datum und Uhrzeit sind getrennte
// Felder, beide optional.
// - kein Startdatum            → Event ohne Termin (startAt/endAt null)
// - Datum ohne Uhrzeit         → „Uhrzeit folgt“ (timeTbd, Speicherformat aus event-date.ts)
// - Startzeit ohne Endzeit     → Ende 2 Stunden nach Start
// - kein Enddatum              → gleicher Tag wie der Start
import { tbdDateInput, tbdIso } from "./event-date";

export interface DateInputs {
  startDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endDate: string;
  endTime: string;
}

export interface EventDates {
  startAt: string | null;
  endAt: string | null;
  timeTbd: boolean;
}

export type DateInputError = "startDateMissing" | "startTimeMissing" | "endBeforeStart";

export type DateInputResult =
  | { ok: true; value: EventDates }
  | { ok: false; error: DateInputError };

const DEFAULT_DURATION_MS = 2 * 60 * 60 * 1000;

export function fromDateInputs(i: DateInputs): DateInputResult {
  if (!i.startDate) {
    if (i.endDate || i.startTime || i.endTime) return { ok: false, error: "startDateMissing" };
    return { ok: true, value: { startAt: null, endAt: null, timeTbd: false } };
  }
  const endDate = i.endDate || i.startDate;
  if (endDate < i.startDate) return { ok: false, error: "endBeforeStart" };

  if (!i.startTime) {
    if (i.endTime) return { ok: false, error: "startTimeMissing" };
    return {
      ok: true,
      value: {
        startAt: tbdIso(i.startDate, "start"),
        endAt: tbdIso(endDate, "end"),
        timeTbd: true,
      },
    };
  }

  const start = new Date(`${i.startDate}T${i.startTime}`);
  const end = i.endTime
    ? new Date(`${endDate}T${i.endTime}`)
    : new Date(start.getTime() + DEFAULT_DURATION_MS);
  if (end.getTime() <= start.getTime()) return { ok: false, error: "endBeforeStart" };
  return {
    ok: true,
    value: { startAt: start.toISOString(), endAt: end.toISOString(), timeTbd: false },
  };
}

const pad = (n: number) => String(n).padStart(2, "0");
function localDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function localTime(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function toDateInputs(
  startAt: string | null,
  endAt: string | null,
  timeTbd: boolean | undefined,
): DateInputs {
  if (!startAt) return { startDate: "", startTime: "", endDate: "", endTime: "" };
  if (timeTbd) {
    const startDate = tbdDateInput(startAt);
    const endDate = endAt ? tbdDateInput(endAt) : "";
    return { startDate, startTime: "", endDate: endDate === startDate ? "" : endDate, endTime: "" };
  }
  const s = new Date(startAt);
  const e = endAt ? new Date(endAt) : null;
  const startDate = localDate(s);
  const endDate = e ? localDate(e) : "";
  return {
    startDate,
    startTime: localTime(s),
    endDate: endDate === startDate ? "" : endDate,
    endTime: e ? localTime(e) : "",
  };
}
