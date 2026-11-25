import { useTranslation } from "react-i18next";
import { type DateInputs, fromDateInputs } from "./event-date-input";

interface Props {
  idPrefix: string;
  value: DateInputs;
  onChange: (v: DateInputs) => void;
}

// Termin eines Events (Runde 7): Datum und Uhrzeit getrennt, alles optional.
// Ohne Uhrzeit → „Uhrzeit folgt“, ohne Datum → Event ohne Termin.
export function EventDateFields({ idPrefix, value, onChange }: Props) {
  const { t } = useTranslation();
  const set = (patch: Partial<DateInputs>) => onChange({ ...value, ...patch });
  const check = fromDateInputs(value);

  return (
    <div style={{ marginBottom: "var(--space-4)" }}>
      <div className="field-row">
        <div className="field">
          <label className="label" htmlFor={`${idPrefix}-start-date`}>
            {t("events.fieldStart")}
          </label>
          <div className="row" style={{ gap: "var(--space-2)", flexWrap: "nowrap" }}>
            <input
              id={`${idPrefix}-start-date`}
              className="input"
              type="date"
              value={value.startDate}
              onChange={(e) => set({ startDate: e.target.value })}
            />
            <input
              className="input"
              type="time"
              aria-label={t("events.fieldStartTime")}
              style={{ maxWidth: 130 }}
              value={value.startTime}
              onChange={(e) => set({ startTime: e.target.value })}
            />
          </div>
        </div>
        <div className="field">
          <label className="label" htmlFor={`${idPrefix}-end-date`}>
            {t("events.fieldEnd")}
          </label>
          <div className="row" style={{ gap: "var(--space-2)", flexWrap: "nowrap" }}>
            <input
              id={`${idPrefix}-end-date`}
              className="input"
              type="date"
              min={value.startDate || undefined}
              value={value.endDate}
              onChange={(e) => set({ endDate: e.target.value })}
            />
            <input
              className="input"
              type="time"
              aria-label={t("events.fieldEndTime")}
              style={{ maxWidth: 130 }}
              value={value.endTime}
              onChange={(e) => set({ endTime: e.target.value })}
            />
          </div>
        </div>
      </div>
      <p className="help-text" style={{ marginTop: 0 }}>
        {t("events.fieldDateHint")}
      </p>
      {!check.ok && (
        <p className="help-text" role="alert" style={{ color: "#b42318", fontWeight: 600 }}>
          {t(`events.dateError.${check.error}`)}
        </p>
      )}
    </div>
  );
}
