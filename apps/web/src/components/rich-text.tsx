import DOMPurify from "dompurify";
import { useMemo } from "react";
import { isRichTextHtml } from "./rich-text-utils";

const ALLOWED_TAGS = ["p", "br", "strong", "b", "em", "i", "u", "s", "ul", "ol", "li", "span"];

// Vom style-Attribut nur die Textfarbe behalten — kein Layout-CSS aus Fremdinhalten
DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (!(node instanceof HTMLElement) || !node.hasAttribute("style")) return;
  const color = node.style.color;
  node.removeAttribute("style");
  if (color) node.style.color = color;
});

// Zeigt eine Beschreibung formatiert an; Alt-Bestand ohne HTML bleibt reiner Text
export function RichText({ value, className }: { value: string; className?: string }) {
  const html = useMemo(
    () =>
      isRichTextHtml(value)
        ? DOMPurify.sanitize(value, { ALLOWED_TAGS, ALLOWED_ATTR: ["style"] })
        : null,
    [value],
  );

  if (html === null) {
    return (
      <div className={className} style={{ whiteSpace: "pre-wrap" }}>
        {value}
      </div>
    );
  }
  return (
    <div
      className={["rich-text", className].filter(Boolean).join(" ")}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: per DOMPurify auf Formatierungs-Tags beschränkt
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
