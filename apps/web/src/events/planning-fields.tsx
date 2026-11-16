import { useTranslation } from "react-i18next";
import {
  EVENT_KINDS,
  GOAL_RESULTS,
  type PlanningFieldsValue,
  RECURRENCES,
} from "./project-plan-types";

/**
 * Event/Projekt-Umschalter + Planungsfelder aus der Jahresplanung (Feedback-Runde 5).
 * Nur für das EXM-Team; gespeichert in Plan-Meta, nicht am Event.
 */
export function PlanningFields({
  idPrefix,
  value,
  onChange,
  showGoal = true,
}: {
  idPrefix: string;
  value: PlanningFieldsValue;
  onChange: (next: PlanningFieldsValue) => void;
  showGoal?: boolean;
}) {
  const { t } = useTranslation();
  const set = (patch: Partial<PlanningFieldsValue>) => onChange({ ...value, ...patch });
  const toggleCategory = (cat: number) =>
    set({
      targetCategories: value.targetCategories.includes(cat)
        ? value.targetCategories.filter((c) => c !== cat)
        : [...value.targetCategories, cat].sort((a, b) => a - b),
    });

  return (
    <>
      <div className="field">
        <div className="label">{t("planning.kindLabel")}</div>
        <div className="row" style={{ gap: "var(--space-2)", flexWrap: "wrap" }}>
          {EVENT_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              className={`btn btn-sm ${value.kind === k ? "btn-primary" : "btn-outline"}`}
              aria-pressed={value.kind === k}
              onClick={() => set({ kind: k })}
            >
              {t(`planning.kind.${k}`)}
            </button>
          ))}
        </div>
        <p className="help-text">{t(`planning.kindHint.${value.kind}`)}</p>
      </div>

      <div className="field-row">
        <div className="field">
          <label className="label" htmlFor={`${idPrefix}-target`}>
            {t("planning.targetCount")}
          </label>
          <input
            id={`${idPrefix}-target`}
            className="input"
            maxLength={100}
            placeholder={t("planning.targetCountPlaceholder")}
            value={value.targetCount ?? ""}
            onChange={(e) => set({ targetCount: e.target.value || null })}
          />
        </div>
        <div className="field">
          <div className="label">{t("planning.categories")}</div>
          <div className="row" style={{ gap: "var(--space-2)" }}>
            {[1, 2, 3].map((cat) => (
              <label key={cat} className="row" style={{ gap: 4 }}>
                <input
                  type="checkbox"
                  checked={value.targetCategories.includes(cat)}
                  onChange={() => toggleCategory(cat)}
                />
                {cat}
              </label>
            ))}
          </div>
          <p className="help-text">{t("planning.categoriesHint")}</p>
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label className="label" htmlFor={`${idPrefix}-recurrence`}>
            {t("planning.recurrence")}
          </label>
          <select
            id={`${idPrefix}-recurrence`}
            className="select"
            value={value.recurrence ?? ""}
            onChange={(e) =>
              set({ recurrence: (e.target.value || null) as PlanningFieldsValue["recurrence"] })
            }
          >
            <option value="">–</option>
            {RECURRENCES.map((r) => (
              <option key={r} value={r}>
                {r} – {t(`planning.recurrenceLabel.${r}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor={`${idPrefix}-alt`}>
            {t("planning.alternativeDate")}
          </label>
          <input
            id={`${idPrefix}-alt`}
            type="date"
            className="input"
            value={value.alternativeDate ?? ""}
            onChange={(e) => set({ alternativeDate: e.target.value || null })}
          />
        </div>
        {showGoal && (
          <div className="field">
            <label className="label" htmlFor={`${idPrefix}-goal`}>
              {t("planning.goalReached")}
            </label>
            <select
              id={`${idPrefix}-goal`}
              className="select"
              value={value.goalReached ?? ""}
              onChange={(e) =>
                set({ goalReached: (e.target.value || null) as PlanningFieldsValue["goalReached"] })
              }
            >
              <option value="">–</option>
              {GOAL_RESULTS.map((g) => (
                <option key={g} value={g}>
                  {t(`planning.goal.${g}`)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </>
  );
}

/** Kurzzeile für die Ansicht: „Ziel 140 MA · Kat. 1,2 · W · erreicht". */
export function planningSummary(v: PlanningFieldsValue, t: (key: string) => string): string | null {
  const parts: string[] = [];
  if (v.targetCount) parts.push(`${t("planning.targetShort")} ${v.targetCount}`);
  if (v.targetCategories.length > 0) {
    parts.push(`${t("planning.categoriesShort")} ${v.targetCategories.join(",")}`);
  }
  if (v.recurrence)
    parts.push(`${v.recurrence} – ${t(`planning.recurrenceLabel.${v.recurrence}`)}`);
  if (v.alternativeDate) {
    parts.push(
      `${t("planning.alternativeShort")} ${v.alternativeDate.split("-").reverse().join(".")}`,
    );
  }
  if (v.goalReached) parts.push(t(`planning.goal.${v.goalReached}`));
  return parts.length > 0 ? parts.join(" · ") : null;
}
