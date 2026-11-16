import { useTranslation } from "react-i18next";
import { type AssigneeDto, CONTENT_CHANNELS, type ContentChannel } from "./project-plan-types";
import type { EventDto } from "./types";

export interface ContentFormValue {
  id: string | null;
  date: string;
  title: string;
  channel: ContentChannel;
  responsibleId: string;
  eventId: string;
  note: string;
}

/** Formular für einen Contentplan-Eintrag (neu oder bearbeiten). */
export function ContentEntryForm({
  value,
  assignees,
  events,
  pending,
  error,
  onChange,
  onSave,
  onDelete,
  onCancel,
}: {
  value: ContentFormValue;
  assignees: AssigneeDto[];
  events: EventDto[];
  pending: boolean;
  error: string | null;
  onChange: (v: ContentFormValue) => void;
  onSave: () => void;
  onDelete?: (() => void) | undefined;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const set = (patch: Partial<ContentFormValue>) => onChange({ ...value, ...patch });
  const sortedEvents = [...events].sort((a, b) => a.title.localeCompare(b.title, "de"));

  return (
    <form
      className="card"
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      <h3 style={{ marginTop: 0 }}>
        {value.id ? t("planning.editEntry") : t("planning.addEntry")}
      </h3>
      <div className="field-row">
        <div className="field">
          <label className="label" htmlFor="cp-date">
            {t("planning.date")}
          </label>
          <input
            id="cp-date"
            type="date"
            className="input"
            required
            value={value.date}
            onChange={(e) => set({ date: e.target.value })}
          />
        </div>
        <div className="field" style={{ flex: 3 }}>
          <label className="label" htmlFor="cp-title">
            {t("planning.titleLabel")}
          </label>
          <input
            id="cp-title"
            className="input"
            required
            maxLength={300}
            placeholder={t("planning.titlePlaceholder")}
            value={value.title}
            onChange={(e) => set({ title: e.target.value })}
          />
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label className="label" htmlFor="cp-channel">
            {t("planning.channelLabel")}
          </label>
          <select
            id="cp-channel"
            className="select"
            value={value.channel}
            onChange={(e) => set({ channel: e.target.value as ContentChannel })}
          >
            {CONTENT_CHANNELS.map((c) => (
              <option key={c} value={c}>
                {t(`planning.channel.${c}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="cp-person">
            {t("planning.personLabel")}
          </label>
          <select
            id="cp-person"
            className="select"
            value={value.responsibleId}
            onChange={(e) => set({ responsibleId: e.target.value })}
          >
            <option value="">–</option>
            {assignees.map((a) => (
              <option key={a.id} value={a.id}>
                {a.displayName}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="cp-event">
            {t("planning.linkedEvent")}
          </label>
          <select
            id="cp-event"
            className="select"
            value={value.eventId}
            onChange={(e) => set({ eventId: e.target.value })}
          >
            <option value="">–</option>
            {sortedEvents.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.title}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="field">
        <label className="label" htmlFor="cp-note">
          {t("planning.note")}
        </label>
        <textarea
          id="cp-note"
          className="textarea"
          rows={2}
          maxLength={2000}
          value={value.note}
          onChange={(e) => set({ note: e.target.value })}
        />
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="row" style={{ gap: "var(--space-2)" }}>
        <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
          {t("planning.save")}
        </button>
        <button type="button" className="btn btn-outline btn-sm" onClick={onCancel}>
          {t("planning.cancel")}
        </button>
        {onDelete && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={pending}
            onClick={() => {
              if (window.confirm(t("planning.confirmDelete"))) onDelete();
            }}
          >
            {t("planning.delete")}
          </button>
        )}
      </div>
    </form>
  );
}
