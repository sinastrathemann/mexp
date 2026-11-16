/** Gesetzliche Feiertage in NRW für ein Jahr (berechnet, nicht gespeichert). */
export interface Holiday {
  date: string; // YYYY-MM-DD
  title: string;
}

/** Ostersonntag nach der Gauß'schen Osterformel (Anonymer Gregorianischer Algorithmus). */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function nrwHolidays(year: number): Holiday[] {
  const easter = easterSunday(year);
  const fromEaster = (days: number) => iso(new Date(easter.getTime() + days * 86_400_000));
  const fixed = (m: number, d: number) => iso(new Date(Date.UTC(year, m - 1, d)));
  return [
    { date: fixed(1, 1), title: "Neujahr" },
    { date: fromEaster(-2), title: "Karfreitag" },
    { date: fromEaster(1), title: "Ostermontag" },
    { date: fixed(5, 1), title: "Maifeiertag" },
    { date: fromEaster(39), title: "Christi Himmelfahrt" },
    { date: fromEaster(50), title: "Pfingstmontag" },
    { date: fromEaster(60), title: "Fronleichnam" },
    { date: fixed(10, 3), title: "Tag der Deutschen Einheit" },
    { date: fixed(11, 1), title: "Allerheiligen" },
    { date: fixed(12, 25), title: "1. Weihnachtsfeiertag" },
    { date: fixed(12, 26), title: "2. Weihnachtsfeiertag" },
  ].sort((x, y) => x.date.localeCompare(y.date));
}
