import { useState } from "react";
import { useTranslation } from "react-i18next";
import { withBasePath } from "../base-path";

interface CopyLinkButtonProps {
  /** App-Pfad inkl. Query, z. B. `/events/123?feedback=1` (Basispfad wird ergänzt) */
  path: string;
  label: string;
  className?: string;
}

/** Kopiert einen Direktlink in die Zwischenablage; ohne Clipboard-Zugriff per Eingabefeld. */
export function CopyLinkButton({
  path,
  label,
  className = "btn btn-outline",
}: CopyLinkButtonProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const url = `${window.location.origin}${withBasePath(path)}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt(label, url);
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button type="button" className={className} onClick={copy}>
      {copied ? `✓ ${t("events.linkCopied")}` : label}
    </button>
  );
}
