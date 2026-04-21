import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../api/client";
import { useAuth } from "../auth/auth-context";
import {
  DOCUMENT_VISIBILITIES,
  type DocumentDto,
  type DocumentVisibility,
  type EventDto,
} from "./types";

interface DocumentsPanelProps {
  event: EventDto;
}

interface FormState {
  name: string;
  mimeType: string;
  fileSize: string;
  visibility: DocumentVisibility;
}

const initialForm: FormState = {
  name: "",
  mimeType: "application/pdf",
  fileSize: "0",
  visibility: "event_staff",
};

export function DocumentsPanel({ event }: DocumentsPanelProps) {
  const { t, i18n } = useTranslation();
  const { hasRole } = useAuth();
  const qc = useQueryClient();
  const canWrite = hasRole("admin", "manager", "event_office");
  const canDelete = hasRole("admin", "manager");
  const [form, setForm] = useState<FormState>(initialForm);
  const [showForm, setShowForm] = useState(false);

  const docsQ = useQuery({
    queryKey: ["events", event.id, "documents"],
    queryFn: () => apiFetch<{ documents: DocumentDto[] }>(`/events/${event.id}/documents`),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["events", event.id, "documents"] });

  const createMut = useMutation({
    mutationFn: (body: unknown) =>
      apiFetch<{ document: DocumentDto }>(`/events/${event.id}/documents`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      setForm(initialForm);
      setShowForm(false);
      invalidate();
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiFetch<{ ok: true }>(`/documents/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const docs = docsQ.data?.documents ?? [];
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString(i18n.language === "de" ? "de-DE" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  const fmtSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const size = Number(form.fileSize);
    if (!Number.isFinite(size) || size < 0) return;
    createMut.mutate({
      name: form.name,
      mimeType: form.mimeType,
      fileSize: size,
      visibility: form.visibility,
    });
  };

  return (
    <section style={{ marginTop: "2rem" }}>
      <h2 style={{ fontSize: "1.1rem" }}>{t("documents.title")}</h2>

      {canWrite && (
        <div style={{ marginBottom: "1rem" }}>
          <button type="button" onClick={() => setShowForm((s) => !s)}>
            {showForm ? t("common.cancel") : t("documents.addItem")}
          </button>
          <span style={{ marginLeft: "1rem", color: "#888", fontSize: "0.85rem" }}>
            {t("documents.uploadHint")}
          </span>
        </div>
      )}

      {showForm && canWrite && (
        <form
          onSubmit={handleCreate}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0.5rem",
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: "1rem",
            marginBottom: "1rem",
          }}
        >
          <label style={{ gridColumn: "1 / -1" }}>
            {t("documents.fieldName")}
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              style={{ width: "100%" }}
            />
          </label>
          <label>
            {t("documents.fieldMimeType")}
            <input
              type="text"
              value={form.mimeType}
              onChange={(e) => setForm({ ...form, mimeType: e.target.value })}
              required
              style={{ width: "100%" }}
            />
          </label>
          <label>
            {t("documents.fieldFileSize")}
            <input
              type="number"
              min={0}
              value={form.fileSize}
              onChange={(e) => setForm({ ...form, fileSize: e.target.value })}
              style={{ width: "100%" }}
            />
          </label>
          <label style={{ gridColumn: "1 / -1" }}>
            {t("documents.fieldVisibility")}
            <select
              value={form.visibility}
              onChange={(e) =>
                setForm({ ...form, visibility: e.target.value as DocumentVisibility })
              }
              style={{ width: "100%" }}
            >
              {DOCUMENT_VISIBILITIES.map((v) => (
                <option key={v} value={v}>
                  {t(`documents.visibility.${v}`)}
                </option>
              ))}
            </select>
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

      {docsQ.isLoading ? (
        <p>{t("auth.loading")}</p>
      ) : docs.length === 0 ? (
        <p style={{ color: "#888" }}>{t("documents.empty")}</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
              <th style={{ padding: "0.5rem" }}>{t("documents.fieldName")}</th>
              <th style={{ padding: "0.5rem" }}>{t("documents.fieldMimeType")}</th>
              <th style={{ padding: "0.5rem", textAlign: "right" }}>
                {t("documents.fieldFileSize")}
              </th>
              <th style={{ padding: "0.5rem" }}>{t("documents.fieldVisibility")}</th>
              <th style={{ padding: "0.5rem" }}>{t("documents.fieldUploadedAt")}</th>
              {canDelete && <th style={{ padding: "0.5rem" }}>{t("documents.fieldActions")}</th>}
            </tr>
          </thead>
          <tbody>
            {docs.map((doc) => (
              <tr key={doc.id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "0.5rem" }}>{doc.name}</td>
                <td style={{ padding: "0.5rem" }}>{doc.mimeType}</td>
                <td style={{ padding: "0.5rem", textAlign: "right" }}>{fmtSize(doc.fileSize)}</td>
                <td style={{ padding: "0.5rem" }}>{t(`documents.visibility.${doc.visibility}`)}</td>
                <td style={{ padding: "0.5rem" }}>{fmtDate(doc.uploadedAt)}</td>
                {canDelete && (
                  <td style={{ padding: "0.5rem" }}>
                    <button
                      type="button"
                      onClick={() => deleteMut.mutate(doc.id)}
                      disabled={deleteMut.isPending}
                    >
                      {t("documents.delete")}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
