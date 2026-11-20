/**
 * Verschiebt Start/Ende eines Events auf einen neuen Starttag (YYYY-MM-DD).
 * Uhrzeit (lokal) und Dauer bleiben erhalten — fürs Duplizieren (Runde 6).
 */
export function shiftEventDates(
  startAt: string,
  endAt: string,
  newDay: string,
): { startAt: string; endAt: string } {
  const start = new Date(startAt);
  const [y, m, d] = newDay.split("-").map(Number);
  const shifted = new Date(start);
  shifted.setFullYear(y ?? start.getFullYear(), (m ?? 1) - 1, d ?? 1);
  const duration = new Date(endAt).getTime() - start.getTime();
  return {
    startAt: shifted.toISOString(),
    endAt: new Date(shifted.getTime() + duration).toISOString(),
  };
}

/** Lokaler Kalendertag eines ISO-Zeitpunkts als YYYY-MM-DD. */
export function localDay(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
