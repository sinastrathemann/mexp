import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ApiRequestError, apiFetch } from "../api/client";
import {
  EVENT_TYPES,
  EVENT_VISIBILITIES,
  type EventDto,
  type EventType,
  type EventVisibility,
  type UserFacetsDto,
} from "../events/types";

export default function EventCreatePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventType, setEventType] = useState<EventType>("team");
  const [visibility, setVisibility] = useState<EventVisibility>("internal");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [location, setLocation] = useState("");
  const [locationDetails, setLocationDetails] = useState("");
  const [capacity, setCapacity] = useState("");
  const [registrationDeadline, setRegistrationDeadline] = useState("");
  const [audienceScope, setAudienceScope] = useState<
    "all" | "roles" | "emails" | "teams" | "departments"
  >("all");
  const [audienceRoles, setAudienceRoles] = useState<string[]>([]);
  const [audienceEmailsRaw, setAudienceEmailsRaw] = useState("");
  const [audienceTeams, setAudienceTeams] = useState<string[]>([]);
  const [audienceDepartments, setAudienceDepartments] = useState<string[]>([]);

  const facets = useQuery({
    queryKey: ["users", "facets"],
    queryFn: () => apiFetch<UserFacetsDto>("/users/facets"),
    enabled: audienceScope === "teams" || audienceScope === "departments",
  });

  const createMut = useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      apiFetch<{ event: EventDto }>("/events", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["events"] });
      navigate(`/events/${res.event.id}`);
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    const emails = audienceEmailsRaw
      .split(/[\s,;]+/)
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.includes("@"));
    createMut.mutate({
      title,
      description,
      eventType,
      visibility,
      startAt: new Date(startAt).toISOString(),
      endAt: new Date(endAt).toISOString(),
      location: location || null,
      locationDetails: locationDetails.trim() === "" ? null : locationDetails.trim(),
      capacity: capacity ? Number.parseInt(capacity, 10) : null,
      registrationDeadline: registrationDeadline
        ? new Date(registrationDeadline).toISOString()
        : null,
      audienceScope,
      audienceRoles: audienceScope === "roles" ? audienceRoles : [],
      audienceEmails: audienceScope === "emails" ? emails : [],
      audienceTeams: audienceScope === "teams" ? audienceTeams : [],
      audienceDepartments: audienceScope === "departments" ? audienceDepartments : [],
    });
  }

  const errMsg =
    createMut.error instanceof ApiRequestError
      ? createMut.error.message
      : createMut.error instanceof Error
        ? createMut.error.message
        : null;

  return (
    <div className="page page-narrow">
      <div className="page-header">
        <div>
          <div className="eyebrow">Events</div>
          <h1 className="page-title">{t("events.createTitle")}</h1>
        </div>
      </div>
      <form onSubmit={submit} className="card">
        <div className="field">
          <label className="label" htmlFor="ev-title">
            {t("events.fieldTitle")}
          </label>
          <input
            id="ev-title"
            className="input"
            type="text"
            required
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="ev-desc">
            {t("events.fieldDescription")}
          </label>
          <textarea
            id="ev-desc"
            className="textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            maxLength={5000}
          />
        </div>
        <div className="field-row">
          <div className="field">
            <label className="label" htmlFor="ev-type">
              {t("events.fieldType")}
            </label>
            <select
              id="ev-type"
              className="select"
              value={eventType}
              onChange={(e) => setEventType(e.target.value as EventType)}
            >
              {EVENT_TYPES.map((typeKey) => (
                <option key={typeKey} value={typeKey}>
                  {t(`events.type.${typeKey}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="ev-visibility">
              {t("events.fieldVisibility")}
            </label>
            <select
              id="ev-visibility"
              className="select"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as EventVisibility)}
            >
              {EVENT_VISIBILITIES.map((v) => (
                <option key={v} value={v}>
                  {t(`events.visibility.${v}`)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label className="label" htmlFor="ev-start">
              {t("events.fieldStart")}
            </label>
            <input
              id="ev-start"
              className="input"
              type="datetime-local"
              required
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="ev-end">
              {t("events.fieldEnd")}
            </label>
            <input
              id="ev-end"
              className="input"
              type="datetime-local"
              required
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
            />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label className="label" htmlFor="ev-location">
              {t("events.fieldLocation")}
            </label>
            <input
              id="ev-location"
              className="input"
              type="text"
              maxLength={500}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="ev-capacity">
              {t("events.fieldCapacity")}
            </label>
            <input
              id="ev-capacity"
              className="input"
              type="number"
              min={1}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
            />
          </div>
        </div>

        <div className="field">
          <label className="label" htmlFor="ev-location-details">
            Weitere Informationen / Besonderheiten (Parkplätze, Zugang, Ansprechpartner vor Ort
            etc.)
          </label>
          <textarea
            id="ev-location-details"
            className="textarea"
            rows={3}
            value={locationDetails}
            onChange={(e) => setLocationDetails(e.target.value)}
            placeholder="z. B. Barrierefrei, Parkplätze begrenzt, Meetingraum im 2. OG"
          />
        </div>

        <div className="field">
          <label className="label" htmlFor="ev-reg-deadline">
            Anmeldung schließt am
          </label>
          <input
            id="ev-reg-deadline"
            className="input"
            type="datetime-local"
            value={registrationDeadline}
            onChange={(e) => setRegistrationDeadline(e.target.value)}
          />
          <p className="help-text">
            Optional — nach diesem Datum können Mitarbeiter sich nicht mehr selbst anmelden.
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
                ["teams", "Nur bestimmte Teams"],
                ["departments", "Nur bestimmte Bereiche"],
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
              <label className="label" htmlFor="ev-allowed-roles">
                Erlaubte Rollen
              </label>
              <div id="ev-allowed-roles" className="row" style={{ gap: 8, flexWrap: "wrap" }}>
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
              <label className="label" htmlFor="ev-aud-emails">
                E-Mail-Liste (kommagetrennt)
              </label>
              <textarea
                id="ev-aud-emails"
                className="textarea"
                rows={3}
                value={audienceEmailsRaw}
                onChange={(e) => setAudienceEmailsRaw(e.target.value)}
                placeholder="max.mustermann@mindsquare.de, lisa.werkstudi@mindsquare.de"
              />
              <p className="help-text">Nur diese Personen sehen das Event in ihrer Event-Liste.</p>
            </div>
          )}

          {audienceScope === "teams" && (
            <div className="field" style={{ margin: "var(--space-3) 0 0" }}>
              <label className="label" htmlFor="ev-aud-teams">
                Sichtbar für Teams
              </label>
              {facets.isLoading && <p className="muted text-sm">Lade Teams…</p>}
              {facets.error instanceof Error && <p className="help-text">{facets.error.message}</p>}
              <div
                id="ev-aud-teams"
                style={{
                  maxHeight: 220,
                  overflow: "auto",
                  border: "1px solid var(--border-default)",
                  borderRadius: "var(--radius-md)",
                  padding: "var(--space-2) var(--space-3)",
                }}
              >
                {facets.data?.teams.map((team) => (
                  <label key={team} style={{ display: "block", padding: "2px 0" }}>
                    <input
                      type="checkbox"
                      checked={audienceTeams.includes(team)}
                      onChange={(e) => {
                        if (e.target.checked) setAudienceTeams((cur) => [...cur, team]);
                        else setAudienceTeams((cur) => cur.filter((t) => t !== team));
                      }}
                    />{" "}
                    {team}
                  </label>
                ))}
                {facets.data && facets.data.teams.length === 0 && (
                  <p className="muted text-sm">Keine Teams gefunden.</p>
                )}
              </div>
              <p className="help-text">
                Nur Mitglieder dieser Teams (aus dem Personio-Sync) sehen das Event.
              </p>
            </div>
          )}

          {audienceScope === "departments" && (
            <div className="field" style={{ margin: "var(--space-3) 0 0" }}>
              <label className="label" htmlFor="ev-aud-departments">
                Sichtbar für Bereiche
              </label>
              {facets.isLoading && <p className="muted text-sm">Lade Bereiche…</p>}
              {facets.error instanceof Error && <p className="help-text">{facets.error.message}</p>}
              <div
                id="ev-aud-departments"
                style={{
                  maxHeight: 220,
                  overflow: "auto",
                  border: "1px solid var(--border-default)",
                  borderRadius: "var(--radius-md)",
                  padding: "var(--space-2) var(--space-3)",
                }}
              >
                {facets.data?.departments.map((dept) => (
                  <label key={dept} style={{ display: "block", padding: "2px 0" }}>
                    <input
                      type="checkbox"
                      checked={audienceDepartments.includes(dept)}
                      onChange={(e) => {
                        if (e.target.checked) setAudienceDepartments((cur) => [...cur, dept]);
                        else setAudienceDepartments((cur) => cur.filter((d) => d !== dept));
                      }}
                    />{" "}
                    {dept}
                  </label>
                ))}
                {facets.data && facets.data.departments.length === 0 && (
                  <p className="muted text-sm">Keine Bereiche gefunden.</p>
                )}
              </div>
              <p className="help-text">
                Nur Mitglieder dieser Bereiche (aus dem Personio-Sync) sehen das Event.
              </p>
            </div>
          )}
        </fieldset>

        {errMsg && <div className="alert alert-error">{errMsg}</div>}

        <div className="form-actions">
          <button type="submit" disabled={createMut.isPending} className="btn btn-primary">
            {createMut.isPending ? t("events.creating") : t("events.create")}
          </button>
          <button type="button" onClick={() => navigate("/events")} className="btn btn-outline">
            {t("common.cancel")}
          </button>
        </div>
      </form>
    </div>
  );
}
