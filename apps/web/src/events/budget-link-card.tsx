import { useTranslation } from "react-i18next";
import { BUDGET_TOOL_URL } from "./external-links";

/** Ersetzt BudgetPanel: das Budget lebt im Budget-Control-Agent (keine Doppelerfassung). */
export function BudgetLinkCard() {
  const { t } = useTranslation();
  return (
    <div className="card">
      <h2 className="card-title">{t("projectPlan.budgetTitle")}</h2>
      <p className="muted" style={{ marginTop: "var(--space-2)" }}>
        {t("projectPlan.budgetHint")}
      </p>
      <a
        href={BUDGET_TOOL_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-primary btn-sm"
        style={{ marginTop: "var(--space-3)" }}
      >
        ↗ {t("projectPlan.budgetOpen")}
      </a>
    </div>
  );
}
