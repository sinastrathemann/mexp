import { useTranslation } from "react-i18next";

interface Props {
  idPrefix: string;
  timeTbd: boolean;
  startAt: string;
  endAt: string;
  onTimeTbdChange: (v: boolean) => void;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
}

// Start/Ende eines Events. Bei "Uhrzeit steht noch nicht fest" nur Datumsfelder
// (Werte "YYYY-MM-DD"), sonst datetime-local ("YYYY-MM-DDTHH:mm").
export function EventDateFields({
  idPrefix,
  timeTbd,
  startAt,
  endAt,
  onTimeTbdChange,
  onStartChange,
  onEndChange,
}: Props) {
  const { t } = useTranslation();

  const toggle = (checked: boolean) => {
    onTimeTbdChange(checked);
    if (checked) {
      onStartChange(startAt.slice(0, 10));
      onEndChange(endAt.slice(0, 10));
    } else {
      // Datum behalten, Uhrzeit vorbelegen – lässt sich direkt anpassen
      if (startAt) onStartChange(`${startAt.slice(0, 10)}T09:00`);
      if (endAt) onEndChange(`${endAt.slice(0, 10)}T17:00`);
    }
  };

  const type = timeTbd ? "date" : "datetime-local";
  return (
    <>
      <div className="field-row">
        <div className="field">
          <label className="label" htmlFor={`${idPrefix}-start`}>
            {t("events.fieldStart")}
          </label>
          <input
            id={`${idPrefix}-start`}
            className="input"
            type={type}
            required
            value={startAt}
            onChange={(e) => onStartChange(e.target.value)}
          />
        </div>
        <div className="field">
          <label className="label" htmlFor={`${idPrefix}-end`}>
            {t("events.fieldEnd")}
          </label>
          <input
            id={`${idPrefix}-end`}
            className="input"
            type={type}
            required
            value={endAt}
            onChange={(e) => onEndChange(e.target.value)}
          />
        </div>
      </div>
      <label
        className="text-sm"
        style={{
          display: "inline-flex",
          gap: 6,
          alignItems: "center",
          marginBottom: "var(--space-4)",
        }}
      >
        <input type="checkbox" checked={timeTbd} onChange={(e) => toggle(e.target.checked)} />
        {t("events.fieldTimeTbd")}
      </label>
    </>
  );
}
