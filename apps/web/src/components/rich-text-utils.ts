// Event-Beschreibungen sind entweder Alt-Bestand (reiner Text) oder HTML aus dem Rich-Text-Editor.
// Der Editor erzeugt immer Block-Elemente auf oberster Ebene, daran erkennen wir HTML.
const HTML_BLOCK_START = /^\s*<(p|ul|ol|h[1-6]|blockquote|pre|hr)[\s>/]/i;

export function isRichTextHtml(value: string): boolean {
  return HTML_BLOCK_START.test(value);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Reinen Alt-Text in Absätze übersetzen, damit der Editor Zeilenumbrüche behält
export function plainTextToHtml(text: string): string {
  if (!text.trim()) return "";
  return text
    .split(/\r?\n/)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("");
}

// Für Vorschauen (Karten, Kürzungen): Formatierung entfernen, Zeilenumbrüche behalten
export function richTextToPlain(value: string): string {
  if (!isRichTextHtml(value)) return value;
  return value
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<\/(p|li|h[1-6]|blockquote|pre)>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
