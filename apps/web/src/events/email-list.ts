/** E-Mails aus der Freitext-Liste (komma-, semikolon- oder zeilengetrennt). */
export function parseEmails(raw: string): string[] {
  return raw
    .split(/[\s,;]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.includes("@"));
}

/**
 * Das gerade getippte letzte Wort der Liste, sofern es (noch) keine E-Mail ist —
 * z. B. "jan" in "a@x.de, jan". Dient als Suchbegriff für die Namensvorschläge.
 */
export function pendingToken(raw: string): string {
  const token = raw.match(/[^\s,;]*$/)?.[0] ?? "";
  return token.includes("@") ? "" : token;
}

/**
 * Hängt eine E-Mail an die Liste an, falls sie noch fehlt (Groß-/Kleinschreibung egal).
 * Ein angefangener Name am Ende (siehe pendingToken) wird dabei durch die E-Mail ersetzt.
 */
export function appendEmail(raw: string, email: string): string {
  const normalized = email.trim().toLowerCase();
  const base = raw.slice(0, raw.length - pendingToken(raw).length);
  if (parseEmails(base).includes(normalized)) return base === raw ? raw : base.trimEnd();
  const trimmed = base.trim().replace(/[,;]\s*$/, "");
  return trimmed === "" ? normalized : `${trimmed}, ${normalized}`;
}
