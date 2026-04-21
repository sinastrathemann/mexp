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
  const [eventType, setEventType] = useState<EventType>("training");
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
    <div style={{ padding: "2rem", fontFamily: "system-ui", maxWidth: 700 }}>
      <h1>{t("events.createTitle")}</h1>
      <form
        onSubmit={submit}
        style={{
          display: "grid",
          gap: "1rem",
          border: "1px solid #ddd",
          borderRadius: 8,
          padding: "1.5rem",
        }}
      >
        <label>
          {t("events.fieldTitle")}
          <input
            type="text"
            required
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ display: "block", width: "100%", padding: "0.5rem" }}
          />
        </label>
        <label>
          {t("events.fieldDescription")}
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            maxLength={5000}
            style={{ display: "block", width: "100%", padding: "0.5rem" }}
          />
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <label>
            {t("events.fieldType")}
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value as EventType)}
              style={{ display: "block", width: "100%", padding: "0.5rem" }}
            >
              {EVENT_TYPES.map((typeKey) => (
                <option key={typeKey} value={typeKey}>
                  {t(`events.type.${typeKey}`)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("events.fieldVisibility")}
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as EventVisibility)}
              style={{ display: "block", width: "100%", padding: "0.5rem" }}
            >
              {EVENT_VISIBILITIES.map((v) => (
                <option key={v} value={v}>
                  {t(`events.visibility.${v}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <label>
            {t("events.fieldStart")}
            <input
              type="datetime-local"
              required
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              style={{ display: "block", width: "100%", padding: "0.5rem" }}
            />
          </label>
          <label>
            {t("events.fieldEnd")}
            <input
              type="datetime-local"
              required
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
              style={{ display: "block", width: "100%", padding: "0.5rem" }}
            />
          </label>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1rem" }}>
          <label>
            {t("events.fieldLocation")}
            <input
              type="text"
              maxLength={500}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              style={{ display: "block", width: "100%", padding: "0.5rem" }}
            />
          </label>
          <label>
            {t("events.fieldCapacity")}
            <input
              type="number"
              min={1}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              style={{ display: "block", width: "100%", padding: "0.5rem" }}
            />
          </label>
        </div>

        {errMsg && <p style={{ color: "#b00020", margin: 0 }}>{errMsg}</p>}

        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button
            type="submit"
            disabled={createMut.isPending}
            style={{
              padding: "0.5rem 1rem",
              background: "#1d4ed8",
              color: "white",
              border: 0,
              borderRadius: 6,
            }}
          >
            {createMut.isPending ? t("events.creating") : t("events.create")}
          </button>
          <button
            type="button"
            onClick={() => navigate("/events")}
            style={{ padding: "0.5rem 1rem" }}
          >
            {t("common.cancel")}
          </button>
        </div>
      </form>
    </div>
  );
}
