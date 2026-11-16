import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { apiFetch } from "../api/client";
import { fmtIsoDate } from "./planning-utils";
import type { ContentPlanEntryDto } from "./project-plan-types";

/** „Geplante Kommunikation" im Projektplan eines Events (nur EXM, Feedback-Runde 5). */
export function EventContentCard({ eventId }: { eventId: string }) {
  const { t } = useTranslation();
  const q = useQuery({
    queryKey: ["content-plan", "event", eventId],
    queryFn: () =>
      apiFetch<{ entries: ContentPlanEntryDto[] }>(
        `/content-plan?eventId=${encodeURIComponent(eventId)}`,
      ),
  });
  const entries = q.data?.entries ?? [];

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
        <h3 style={{ margin: 0 }}>🔒 {t("planning.eventContentTitle")}</h3>
        <Link to="/content-plan" className="btn btn-outline btn-sm">
          {t("planning.openContentPlan")}
        </Link>
      </div>
      {q.error instanceof Error && <div className="alert alert-error">{q.error.message}</div>}
      {entries.length === 0 ? (
        <p className="muted">{t("planning.eventContentEmpty")}</p>
      ) : (
        <ul style={{ margin: "var(--space-2) 0 0", paddingLeft: "1.2em" }}>
          {entries.map((e) => (
            <li key={e.id}>
              <strong>{fmtIsoDate(e.date)}</strong> · {e.title}{" "}
              <span className="muted">
                ({t(`planning.channel.${e.channel}`)}
                {e.responsibleName ? ` · ${e.responsibleName}` : ""})
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
