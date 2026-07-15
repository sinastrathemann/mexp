import { useTranslation } from "react-i18next";

const STATUS_CLASS: Record<string, string> = {
  draft: "badge badge-outline",
  planned: "badge badge-yellow",
  open: "badge badge-orange",
  running: "badge badge-success badge-live",
  closed: "badge badge-ink",
  cancelled: "badge badge-muted",
};

export function EventStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const cls = STATUS_CLASS[status] ?? "badge badge-muted";
  return <span className={cls}>{t(`events.status.${status}`)}</span>;
}
