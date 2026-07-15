import { useMutation, useQueryClient } from "@tanstack/react-query";
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
  const [capacity, setCapacity] = useState("");

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
    createMut.mutate({
      title,
      description,
      eventType,
      visibility,
      startAt: new Date(startAt).toISOString(),
      endAt: new Date(endAt).toISOString(),
      location: location || null,
      capacity: capacity ? Number.parseInt(capacity, 10) : null,
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
