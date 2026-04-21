import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api/client";
import { useAuth } from "../auth/auth-context";
import {
  EVENT_TYPES,
  EVENT_VISIBILITIES,
  type EventBlueprintDto,
  type EventDto,
  type EventType,
  type EventVisibility,
} from "../events/types";

interface CreateFormState {
  name: string;
  description: string;
  eventType: EventType;
  visibility: EventVisibility;
  defaultDurationMinutes: string;
  defaultCapacity: string;
  defaultLocation: string;
  defaultDescription: string;
}

const initialCreate: CreateFormState = {
  name: "",
  description: "",
  eventType: "training",
  visibility: "internal",
  defaultDurationMinutes: "120",
  defaultCapacity: "",
  defaultLocation: "",
  defaultDescription: "",
};

export default function BlueprintsPage() {
  const { t } = useTranslation();
  const { hasRole } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const canWrite = hasRole("admin", "manager", "event_office");
  const [form, setForm] = useState<CreateFormState>(initialCreate);
  const [showForm, setShowForm] = useState(false);
  const [applyFor, setApplyFor] = useState<string | null>(null);
  const [applyTitle, setApplyTitle] = useState("");
  const [applyStart, setApplyStart] = useState("");

  const listQ = useQuery({
    queryKey: ["blueprints"],
    queryFn: () => apiFetch<{ blueprints: EventBlueprintDto[] }>("/blueprints"),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["blueprints"] });

  const createMut = useMutation({
    mutationFn: (body: unknown) =>
      apiFetch<{ blueprint: EventBlueprintDto }>("/blueprints", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      setForm(initialCreate);
      setShowForm(false);
      invalidate();
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/blueprints/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const applyMut = useMutation({
    mutationFn: (input: { id: string; title: string; startAt: string }) =>
      apiFetch<{ event: EventDto }>(`/blueprints/${input.id}/apply`, {
        method: "POST",
        body: JSON.stringify({ title: input.title, startAt: input.startAt }),
      }),
    onSuccess: (res) => {
      setApplyFor(null);
      setApplyTitle("");
      setApplyStart("");
      navigate(`/events/${res.event.id}`);
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const duration = Number(form.defaultDurationMinutes);
    if (!Number.isFinite(duration) || duration <= 0) return;
    const capacity = form.defaultCapacity.trim() === "" ? null : Number(form.defaultCapacity);
    createMut.mutate({
      name: form.name,
      description: form.description,
      eventType: form.eventType,
      visibility: form.visibility,
      defaultDurationMinutes: duration,
      defaultCapacity: capacity,
      defaultLocation: form.defaultLocation.trim() === "" ? null : form.defaultLocation,
      defaultDescription: form.defaultDescription,
    });
  };

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyFor) return;
    applyMut.mutate({
      id: applyFor,
      title: applyTitle,
      startAt: new Date(applyStart).toISOString(),
    });
  };

  return (
    <div style={{ padding: "2rem", fontFamily: "system-ui", maxWidth: 1000 }}>
      <h1>{t("blueprints.title")}</h1>
      <p style={{ color: "#555" }}>{t("blueprints.intro")}</p>

      {canWrite && (
        <div style={{ marginBottom: "1rem" }}>
          <button type="button" onClick={() => setShowForm((s) => !s)}>
            {showForm ? t("common.cancel") : t("blueprints.create")}
          </button>
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleCreate}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0.5rem",
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: "1rem",
            marginBottom: "1.5rem",
          }}
        >
          <label style={{ gridColumn: "1 / -1" }}>
            {t("blueprints.fieldName")}
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              style={{ width: "100%" }}
            />
          </label>
          <label style={{ gridColumn: "1 / -1" }}>
            {t("blueprints.fieldDescription")}
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              style={{ width: "100%" }}
            />
          </label>
          <label>
            {t("events.fieldType")}
            <select
              value={form.eventType}
              onChange={(e) => setForm({ ...form, eventType: e.target.value as EventType })}
              style={{ width: "100%" }}
            >
              {EVENT_TYPES.map((x) => (
                <option key={x} value={x}>
                  {t(`events.type.${x}`)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("events.fieldVisibility")}
            <select
              value={form.visibility}
              onChange={(e) => setForm({ ...form, visibility: e.target.value as EventVisibility })}
              style={{ width: "100%" }}
            >
              {EVENT_VISIBILITIES.map((x) => (
                <option key={x} value={x}>
                  {t(`events.visibility.${x}`)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("blueprints.fieldDuration")}
            <input
              type="number"
              min={1}
              required
              value={form.defaultDurationMinutes}
              onChange={(e) => setForm({ ...form, defaultDurationMinutes: e.target.value })}
              style={{ width: "100%" }}
            />
          </label>
          <label>
            {t("blueprints.fieldCapacity")}
            <input
              type="number"
              min={1}
              value={form.defaultCapacity}
              onChange={(e) => setForm({ ...form, defaultCapacity: e.target.value })}
              style={{ width: "100%" }}
            />
          </label>
          <label style={{ gridColumn: "1 / -1" }}>
            {t("blueprints.fieldLocation")}
            <input
              type="text"
              value={form.defaultLocation}
              onChange={(e) => setForm({ ...form, defaultLocation: e.target.value })}
              style={{ width: "100%" }}
            />
          </label>
          <label style={{ gridColumn: "1 / -1" }}>
            {t("blueprints.fieldDefaultDescription")}
            <textarea
              rows={3}
              value={form.defaultDescription}
              onChange={(e) => setForm({ ...form, defaultDescription: e.target.value })}
              style={{ width: "100%" }}
            />
          </label>
          <div style={{ gridColumn: "1 / -1" }}>
            <button type="submit" disabled={createMut.isPending}>
              {t("common.save")}
            </button>
            {createMut.error instanceof Error && (
              <span style={{ color: "#b00020", marginLeft: "1rem" }}>
                {createMut.error.message}
              </span>
            )}
          </div>
        </form>
      )}

      {listQ.isLoading ? (
        <p>{t("auth.loading")}</p>
      ) : (listQ.data?.blueprints.length ?? 0) === 0 ? (
        <p style={{ color: "#888" }}>{t("blueprints.empty")}</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
              <th style={{ padding: "0.5rem" }}>{t("blueprints.fieldName")}</th>
              <th style={{ padding: "0.5rem" }}>{t("events.fieldType")}</th>
              <th style={{ padding: "0.5rem" }}>{t("blueprints.fieldDuration")}</th>
              <th style={{ padding: "0.5rem" }}>{t("blueprints.fieldCapacity")}</th>
              <th style={{ padding: "0.5rem" }}>{t("blueprints.fieldLocation")}</th>
              <th style={{ padding: "0.5rem" }}>{t("blueprints.fieldActions")}</th>
            </tr>
          </thead>
          <tbody>
            {listQ.data?.blueprints.map((bp) => (
              <tr key={bp.id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "0.5rem" }}>
                  <div>{bp.name}</div>
                  {bp.description && (
                    <div style={{ color: "#888", fontSize: "0.85rem" }}>{bp.description}</div>
                  )}
                </td>
                <td style={{ padding: "0.5rem" }}>{t(`events.type.${bp.eventType}`)}</td>
                <td style={{ padding: "0.5rem" }}>{bp.defaultDurationMinutes} min</td>
                <td style={{ padding: "0.5rem" }}>{bp.defaultCapacity ?? "—"}</td>
                <td style={{ padding: "0.5rem" }}>{bp.defaultLocation ?? "—"}</td>
                <td style={{ padding: "0.5rem" }}>
                  {canWrite && (
                    <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => {
                          setApplyFor(bp.id);
                          setApplyTitle(bp.name);
                          setApplyStart("");
                        }}
                      >
                        {t("blueprints.apply")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(t("blueprints.confirmDelete") ?? "Delete?")) {
                            deleteMut.mutate(bp.id);
                          }
                        }}
                      >
                        {t("blueprints.delete")}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {applyFor && (
        <form
          onSubmit={handleApply}
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background: "white",
            border: "1px solid #ccc",
            borderRadius: 8,
            padding: "1.5rem",
            boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
            minWidth: 360,
            display: "grid",
            gap: "0.5rem",
            zIndex: 10,
          }}
        >
          <h2 style={{ margin: 0 }}>{t("blueprints.applyTitle")}</h2>
          <label>
            {t("events.fieldTitle")}
            <input
              type="text"
              required
              value={applyTitle}
              onChange={(e) => setApplyTitle(e.target.value)}
              style={{ width: "100%" }}
            />
          </label>
          <label>
            {t("events.fieldStart")}
            <input
              type="datetime-local"
              required
              value={applyStart}
              onChange={(e) => setApplyStart(e.target.value)}
              style={{ width: "100%" }}
            />
          </label>
          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
            <button type="button" onClick={() => setApplyFor(null)}>
              {t("common.cancel")}
            </button>
            <button type="submit" disabled={applyMut.isPending}>
              {t("blueprints.apply")}
            </button>
          </div>
          {applyMut.error instanceof Error && (
            <p style={{ color: "#b00020", margin: 0 }}>{applyMut.error.message}</p>
          )}
        </form>
      )}
    </div>
  );
}
