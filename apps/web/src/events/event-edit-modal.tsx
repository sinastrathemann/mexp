import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  EVENT_TYPES,
  EVENT_VISIBILITIES,
  type EventDto,
  type EventType,
  type EventVisibility,
} from "./types";

interface Props {
  event: EventDto;
  pending: boolean;
  error: string | null;
  canDelete?: boolean;
  deletePending?: boolean;
  onCancel: () => void;
  onSubmit: (patch: {
    title?: string;
    description?: string;
    eventType?: EventType;
    visibility?: EventVisibility;
    startAt?: string;
    endAt?: string;
    location?: string | null;
    locationDetails?: string | null;
    capacity?: number | null;
    registrationDeadline?: string | null;
    audienceScope?: "all" | "roles" | "emails";
    audienceRoles?: string[];
    audienceEmails?: string[];
  }) => void;
  onDelete?: () => void;
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toIso(local: string): string {
  if (!local) return new Date().toISOString();
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

export function EventEditModal({
  event,
  pending,
  error,
  canDelete = false,
  deletePending = false,
  onCancel,
  onSubmit,
  onDelete,
}: Props) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description);
  const [eventType, setEventType] = useState<EventType>(event.eventType);
  const [visibility, setVisibility] = useState<EventVisibility>(event.visibility);
  const [startAt, setStartAt] = useState(toLocalInput(event.startAt));
  const [endAt, setEndAt] = useState(toLocalInput(event.endAt));
  const [location, setLocation] = useState(event.location ?? "");
  const [locationDetails, setLocationDetails] = useState(event.locationDetails ?? "");
  const [capacity, setCapacity] = useState(event.capacity?.toString() ?? "");
  const [registrationDeadline, setRegistrationDeadline] = useState(
    event.registrationDeadline ? toLocalInput(event.registrationDeadline) : "",
  );
  const [audienceScope, setAudienceScope] = useState<"all" | "roles" | "emails">(
    event.audienceScope ?? "all",
  );
  const [audienceRoles, setAudienceRoles] = useState<string[]>(event.audienceRoles ?? []);
  const [audienceEmailsRaw, setAudienceEmailsRaw] = useState<string>(
    (event.audienceEmails ?? []).join(", "),
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const capNum = capacity.trim() === "" ? null : Number.parseInt(capacity, 10);
    const emails = audienceEmailsRaw
      .split(/[\s,;]+/)
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.includes("@"));
    onSubmit({
      title: title.trim(),
      description: description,
      eventType,
      visibility,
      startAt: toIso(startAt),
      endAt: toIso(endAt),
      location: location.trim() === "" ? null : location.trim(),
      locationDetails: locationDetails.trim() === "" ? null : locationDetails.trim(),
      capacity: capNum,
      registrationDeadline: registrationDeadline ? toIso(registrationDeadline) : null,
      audienceScope,
      audienceRoles: audienceScope === "roles" ? audienceRoles : [],
      audienceEmails: audienceScope === "emails" ? emails : [],
    });
  };

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ maxWidth: 640 }}>
        <div className="card-header" style={{ marginBottom: "var(--space-2)" }}>
          <div>
            <div className="eyebrow">Bearbeiten</div>
            <h2 className="card-title" style={{ marginTop: 4 }}>
              Event-Details anpassen
            </h2>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
            ×
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          onKeyDown={(e) => {
            // Enter in Inputs soll NICHT versehentlich speichern.
            // Textarea darf Newlines erlauben.
            if (
              e.key === "Enter" &&
              (e.target as HTMLElement).tagName !== "TEXTAREA" &&
              (e.target as HTMLElement).tagName !== "BUTTON"
            ) {
              e.preventDefault();
            }
          }}
          style={{ marginTop: "var(--space-4)" }}
        >
          <div className="field">
            <label className="label" htmlFor="ee-title">
              {t("events.fieldTitle")}
            </label>
            <input
              id="ee-title"
              className="input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={200}
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="ee-desc">
              {t("events.fieldDescription")}
            </label>
            <textarea
              id="ee-desc"
              className="textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>

          <div className="field-row">
            <div className="field">
              <label className="label" htmlFor="ee-type">
                {t("events.fieldType")}
              </label>
              <select
                id="ee-type"
                className="select"
                value={eventType}
                onChange={(e) => setEventType(e.target.value as EventType)}
              >
                {EVENT_TYPES.map((tk) => (
                  <option key={tk} value={tk}>
                    {t(`events.type.${tk}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="label" htmlFor="ee-vis">
                {t("events.fieldVisibility")}
              </label>
              <select
                id="ee-vis"
                className="select"
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as EventVisibility)}
              >
                {EVENT_VISIBILITIES.map((vk) => (
                  <option key={vk} value={vk}>
                    {t(`events.visibility.${vk}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label className="label" htmlFor="ee-start">
                {t("events.fieldStart")}
              </label>
              <input
                id="ee-start"
                className="input"
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label className="label" htmlFor="ee-end">
                {t("events.fieldEnd")}
              </label>
              <input
                id="ee-end"
                className="input"
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label className="label" htmlFor="ee-loc">
                {t("events.fieldLocation")}
              </label>
              <input
                id="ee-loc"
                className="input"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="z. B. Bielefeld HQ, Heidewald, Online"
              />
            </div>
            <div className="field">
              <label className="label" htmlFor="ee-cap">
                {t("events.fieldCapacity")}
              </label>
              <input
                id="ee-cap"
                className="input"
                type="number"
                min={1}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="field">
            <label className="label" htmlFor="ee-loc-details">
              Location-Details (Adresse, Parkmöglichkeiten, Besonderheiten)
            </label>
            <textarea
              id="ee-loc-details"
              className="textarea"
              rows={3}
              value={locationDetails}
              onChange={(e) => setLocationDetails(e.target.value)}
              placeholder={
                "Adresse · Wegbeschreibung · Parkplätze · Hinweise zur Planung\n\nDieser Text ist auch für Teilnehmer sichtbar."
              }
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="ee-deadline">
              Anmeldung schließen am (optional)
            </label>
            <input
              id="ee-deadline"
              className="input"
              type="datetime-local"
              value={registrationDeadline}
              onChange={(e) => setRegistrationDeadline(e.target.value)}
            />
            <p className="help-text">
              Nach diesem Datum können Mitarbeiter sich nicht mehr selbst anmelden.
            </p>
          </div>

          <fieldset
            style={{
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-md)",
              padding: "var(--space-3) var(--space-4) var(--space-4)",
              margin: "var(--space-4) 0",
            }}
          >
            <legend
              style={{
                padding: "0 var(--space-2)",
                fontFamily: "var(--font-mono)",
                fontSize: "var(--label-size)",
                fontWeight: 700,
                letterSpacing: "var(--tracking-wider)",
                textTransform: "uppercase",
                color: "var(--fg-strong)",
              }}
            >
              Teilnehmerkreis
            </legend>
            <p className="help-text" style={{ marginTop: 0 }}>
              Wer darf dieses Event sehen? Verwaltungs-Rollen sehen es immer.
            </p>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              {(
                [
                  ["all", "Alle Mitarbeiter"],
                  ["roles", "Nur bestimmte Rollen"],
                  ["emails", "Nur bestimmte Personen"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={
                    audienceScope === key ? "btn btn-primary btn-sm" : "btn btn-outline btn-sm"
                  }
                  onClick={() => setAudienceScope(key)}
                >
                  {label}
                </button>
              ))}
            </div>

            {audienceScope === "roles" && (
              <div className="field" style={{ margin: "var(--space-3) 0 0" }}>
                <label className="label" htmlFor="allowed-roles">Erlaubte Rollen</label>
                <div id="allowed-roles" className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                  {(
                    [
                      "participant",
                      "werkstudent",
                      "event_office",
                      "budget_owner",
                      "manager",
                      "read_only",
                    ] as const
                  ).map((r) => {
                    const checked = audienceRoles.includes(r);
                    return (
                      <button
                        key={r}
                        type="button"
                        className={checked ? "btn btn-primary btn-sm" : "btn btn-outline btn-sm"}
                        onClick={() =>
                          setAudienceRoles((cur) =>
                            checked ? cur.filter((x) => x !== r) : [...cur, r],
                          )
                        }
                      >
                        {checked ? "✓ " : ""}
                        {r}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {audienceScope === "emails" && (
              <div className="field" style={{ margin: "var(--space-3) 0 0" }}>
                <label className="label" htmlFor="ee-aud-emails">
                  E-Mail-Liste (kommagetrennt)
                </label>
                <textarea
                  id="ee-aud-emails"
                  className="textarea"
                  rows={3}
                  value={audienceEmailsRaw}
                  onChange={(e) => setAudienceEmailsRaw(e.target.value)}
                  placeholder="max.mustermann@mindsquare.de, lisa.werkstudi@mindsquare.de"
                />
                <p className="help-text">
                  Nur diese Personen sehen das Event in ihrer Event-Liste.
                </p>
              </div>
            )}
          </fieldset>

          {error && (
            <div className="alert alert-error" role="alert" style={{ marginTop: "var(--space-3)" }}>
              {error}
            </div>
          )}

          <div
            className="form-actions"
            style={{
              marginTop: "var(--space-5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "var(--space-3)",
              flexWrap: "wrap",
            }}
          >
            <div className="row" style={{ gap: "var(--space-3)" }}>
              <button type="submit" disabled={pending || deletePending} className="btn btn-primary">
                {pending ? "Speichere…" : "Änderungen speichern"}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={onCancel}
                disabled={pending || deletePending}
              >
                Abbrechen
              </button>
            </div>
            {canDelete && onDelete && (
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  if (window.confirm(`Event "${event.title}" wirklich löschen?`)) onDelete();
                }}
                disabled={pending || deletePending}
                title="Nur Admin"
              >
                {deletePending ? "Lösche…" : "🗑 Event löschen"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
