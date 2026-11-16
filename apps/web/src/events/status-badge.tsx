import { useTranslation } from "react-i18next";

const STATUS_CLASS: Record<string, string> = {
  draft: "badge badge-outline",
  planned: "badge badge-yellow",
  open: "badge badge-orange",
  running: "badge badge-success badge-live",
  closed: "badge badge-ink",
  cancelled: "badge badge-muted",
};

export function EventStatusBadge({
  status,
  project = false,
}: { status: string; project?: boolean }) {
  const { t } = useTranslation();
  const cls = STATUS_CLASS[status] ?? "badge badge-muted";
  // Projekte (Runde 5) haben keine Anmeldung: eigene Phasennamen, gleicher Status darunter.
  const label =
    project && PROJECT_PHASE_KEYS[status]
      ? t(PROJECT_PHASE_KEYS[status])
      : t(`events.status.${status}`);
  return <span className={cls}>{label}</span>;
}

/** Phasennamen für Projekte; der gespeicherte Status bleibt derselbe wie bei Events. */
export const PROJECT_PHASE_KEYS: Record<string, string> = {
  open: "planning.projectPhase.open",
  running: "planning.projectPhase.running",
};
