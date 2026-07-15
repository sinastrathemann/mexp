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
  const canWrite = hasRole("admin", "manager", "event_office", "werkstudent");
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

  // Mitarbeiter (ohne Verwaltungs-Rolle) sehen den Dokumente-Bereich komplett nicht
  if (!canWrite) return null;

  return (
    <section className="card">
      <div className="card-header">
        <h2 className="card-title">{t("documents.title")}</h2>
        {canWrite && (
          <button
            type="button"
            onClick={() => setShowForm((s) => !s)}
            className={showForm ? "btn btn-outline btn-sm" : "btn btn-primary btn-sm"}
          >
            {showForm ? t("common.cancel") : `+ ${t("documents.addItem")}`}
          </button>
        )}
      </div>
      {canWrite && <p className="muted text-xs">{t("documents.uploadHint")}</p>}

      {showForm && canWrite && (
        <form onSubmit={handleCreate} className="card-flat">
          <div className="field">
            <label className="label" htmlFor="doc-name">
              {t("documents.fieldName")}
            </label>
            <input
              id="doc-name"
              className="input"
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div className="field-row">
            <div className="field">
              <label className="label" htmlFor="doc-mime">
                {t("documents.fieldMimeType")}
              </label>
              <input
                id="doc-mime"
                className="input"
                type="text"
                value={form.mimeType}
                onChange={(e) => setForm({ ...form, mimeType: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label className="label" htmlFor="doc-size">
                {t("documents.fieldFileSize")}
              </label>
              <input
                id="doc-size"
                className="input"
                type="number"
                min={0}
                value={form.fileSize}
                onChange={(e) => setForm({ ...form, fileSize: e.target.value })}
              />
            </div>
          </div>
          <div className="field">
            <label className="label" htmlFor="doc-vis">
              {t("documents.fieldVisibility")}
            </label>
            <select
              id="doc-vis"
              className="select"
              value={form.visibility}
              onChange={(e) =>
                setForm({ ...form, visibility: e.target.value as DocumentVisibility })
              }
            >
              {DOCUMENT_VISIBILITIES.map((v) => (
                <option key={v} value={v}>
                  {t(`documents.visibility.${v}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="form-actions">
            <button type="submit" disabled={createMut.isPending} className="btn btn-primary">
              {t("common.save")}
            </button>
            {createMut.error instanceof Error && (
              <span className="err-msg">{createMut.error.message}</span>
            )}
          </div>
        </form>
      )}

      {docsQ.isLoading ? (
        <p className="muted">{t("auth.loading")}</p>
      ) : docs.length === 0 ? (
        <p className="muted">{t("documents.empty")}</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>{t("documents.fieldName")}</th>
              <th>{t("documents.fieldMimeType")}</th>
              <th style={{ textAlign: "right" }}>{t("documents.fieldFileSize")}</th>
              <th>{t("documents.fieldVisibility")}</th>
              <th>{t("documents.fieldUploadedAt")}</th>
              {canDelete && <th>{t("documents.fieldActions")}</th>}
            </tr>
          </thead>
          <tbody>
            {docs.map((doc) => (
              <tr key={doc.id}>
                <td className="text-bold">{doc.name}</td>
                <td className="muted text-sm">{doc.mimeType}</td>
                <td style={{ textAlign: "right" }}>{fmtSize(doc.fileSize)}</td>
                <td>
                  <span className="badge badge-muted">
                    {t(`documents.visibility.${doc.visibility}`)}
                  </span>
                </td>
                <td className="muted text-sm">{fmtDate(doc.uploadedAt)}</td>
                {canDelete && (
                  <td>
                    <button
                      type="button"
                      onClick={() => deleteMut.mutate(doc.id)}
                      disabled={deleteMut.isPending}
                      className="btn btn-ghost btn-sm"
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
