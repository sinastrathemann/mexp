/** E-Mails aus der Freitext-Liste (komma-, semikolon- oder zeilengetrennt). */
export function parseEmails(raw: string): string[] {
  return raw
    .split(/[\s,;]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.includes("@"));
}

/** Hängt eine E-Mail an die Liste an, falls sie noch fehlt (Groß-/Kleinschreibung egal). */
export function appendEmail(raw: string, email: string): string {
  const normalized = email.trim().toLowerCase();
  if (parseEmails(raw).includes(normalized)) return raw;
  const trimmed = raw.trim().replace(/[,;]\s*$/, "");
  return trimmed === "" ? normalized : `${trimmed}, ${normalized}`;
}
