// Datum/Uhrzeit von Events anzeigen und eingeben, inkl. "Uhrzeit steht noch nicht fest".
//
// Bei offener Uhrzeit (timeTbd) zählt nur das Datum. Gespeichert wird es als UTC-Zeitpunkt
// tagsüber (Start 10:00Z, Ende 14:00Z): so bleibt das Kalenderdatum in allen
// europäischen Zeitzonen gleich und Ende > Start gilt auch bei eintägigen Events.

const TBD_TEXT = { de: "Uhrzeit folgt", en: "time to be announced" } as const;

function locale(lang: string): string {
  return lang === "de" ? "de-DE" : "en-US";
}

export function formatEventDate(
  iso: string,
  timeTbd: boolean | undefined,
  lang: string,
  dateStyle: "medium" | "short" = "medium",
): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  if (timeTbd) {
    const date = d.toLocaleDateString(locale(lang), { dateStyle, timeZone: "UTC" });
    return `${date} · ${lang === "de" ? TBD_TEXT.de : TBD_TEXT.en}`;
  }
  return d.toLocaleString(locale(lang), { dateStyle, timeStyle: "short" });
}

// "YYYY-MM-DD" (Eingabe type=date) → gespeicherter Zeitpunkt bei offener Uhrzeit
export function tbdIso(date: string, edge: "start" | "end"): string {
  return `${date}T${edge === "start" ? "10" : "14"}:00:00.000Z`;
}

// Gespeicherter Zeitpunkt bei offener Uhrzeit → "YYYY-MM-DD"
export function tbdDateInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}
