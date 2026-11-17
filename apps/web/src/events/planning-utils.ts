/** Datums-Helfer für Contentplan und Jahresplanung (lokale Kalendertage, YYYY-MM-DD). */

export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function addDays(iso: string, days: number): string {
  const d = parseIsoDate(iso);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

/** Montag der Woche, in der `iso` liegt. */
export function mondayOf(iso: string): string {
  const d = parseIsoDate(iso);
  const offset = (d.getDay() + 6) % 7; // Mo=0 … So=6
  return addDays(iso, -offset);
}

/** Erster Tag des Monats, in dem `iso` liegt. */
export function firstOfMonth(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

/** Erster Tag des Monats, `months` Monate von `iso` entfernt. */
export function addMonths(iso: string, months: number): string {
  const d = parseIsoDate(firstOfMonth(iso));
  d.setMonth(d.getMonth() + months);
  return toIsoDate(d);
}

/** Montage aller Wochen, die mindestens einen Werktag (Mo–Fr) im Monat von `iso` haben. */
export function monthWeeks(iso: string): string[] {
  const first = firstOfMonth(iso);
  const next = addMonths(first, 1);
  const weeks: string[] = [];
  for (let monday = mondayOf(first); monday < next; monday = addDays(monday, 7)) {
    // Woche nur, wenn einer ihrer Werktage im Monat liegt
    if (addDays(monday, 4) >= first) weeks.push(monday);
  }
  return weeks;
}

/** ISO-Kalenderwoche (KW) nach DIN 1355 / ISO 8601. */
export function isoWeek(iso: string): number {
  const d = parseIsoDate(iso);
  const thursday = new Date(d);
  thursday.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const firstThursday = new Date(thursday.getFullYear(), 0, 4);
  firstThursday.setDate(firstThursday.getDate() + 3 - ((firstThursday.getDay() + 6) % 7));
  return 1 + Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
}

/** "2026-11-17" → "17.11.2026" */
export function fmtIsoDate(iso: string, withYear = true): string {
  const [y, m, d] = iso.split("-");
  return withYear ? `${d}.${m}.${y}` : `${d}.${m}.`;
}

/** Liegt `iso` im (inklusiven) Bereich start..end? */
export function inRange(iso: string, start: string, end: string | null): boolean {
  return iso >= start && iso <= (end ?? start);
}
