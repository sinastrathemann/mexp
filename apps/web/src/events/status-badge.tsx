import { useTranslation } from "react-i18next";

const STATUS_CLASS: Record<string, string> = {
  draft: "badge badge-muted",
  planned: "badge badge-yellow",
  open: "badge badge-orange",
  running: "badge badge-orange",
  closed: "badge badge-muted",
  cancelled: "badge badge-muted",
};

export function EventStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const cls = STATUS_CLASS[status] ?? "badge badge-muted";
  return <span className={cls}>{t(`events.status.${status}`)}</span>;
}
