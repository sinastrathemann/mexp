import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type DragEvent, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiRequestError, apiFetch, apiUpload, apiUrl } from "../api/client";
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

/** Muss zur API passen (MAX_UPLOAD_BYTES in apps/api/src/routes/documents.ts). */
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export function DocumentsPanel({ event }: DocumentsPanelProps) {
  const { t, i18n } = useTranslation();
  const { hasRole } = useAuth();
  const qc = useQueryClient();
  const canWrite = hasRole("admin", "manager", "event_office", "werkstudent");
  // Löschen nur Admin (Sina's Regel: Anlegen/Bearbeiten dürfen mehr Rollen, Löschen nicht).
  const canDelete = hasRole("admin");
  const [showForm, setShowForm] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [visibility, setVisibility] = useState<DocumentVisibility>("event_staff");
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const docsQ = useQuery({
    queryKey: ["events", event.id, "documents"],
    queryFn: () => apiFetch<{ documents: DocumentDto[] }>(`/events/${event.id}/documents`),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["events", event.id, "documents"] });

  const reset = () => {
    setFile(null);
    setVisibility("event_staff");
    setLocalError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const uploadMut = useMutation({
    mutationFn: (body: FormData) =>
      apiUpload<{ document: DocumentDto }>(`/events/${event.id}/documents/upload`, body),
    onSuccess: () => {
      reset();
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

  const pick = (f: File | null | undefined) => {
    uploadMut.reset();
    if (!f) return;
    if (f.size > MAX_UPLOAD_BYTES) {
      setFile(null);
      setLocalError(t("documents.tooLarge"));
      return;
    }
    setLocalError(null);
    setFile(f);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    pick(e.dataTransfer.files[0]);
  };

  const uploadError = uploadMut.error;
  const errorText =
    localError ??
    (uploadError instanceof ApiRequestError && uploadError.status === 413
      ? t("documents.tooLarge")
      : uploadError instanceof Error
        ? uploadError.message
        : null);

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    const body = new FormData();
    body.append("file", file);
    body.append("visibility", visibility);
    uploadMut.mutate(body);
  };

  // Mitarbeiter (ohne Verwaltungs-Rolle) sehen den Dokumente-Bereich komplett nicht
  if (!canWrite) return null;

  return (
    <section className="card">
      <div className="card-header">
        <h2 className="card-title">{t("documents.title")}</h2>
        <button
          type="button"
          onClick={() => {
            reset();
            setShowForm((s) => !s);
          }}
          className={showForm ? "btn btn-outline btn-sm" : "btn btn-primary btn-sm"}
        >
          {showForm ? t("common.cancel") : `+ ${t("documents.addItem")}`}
        </button>
      </div>
      <p className="muted text-xs">{t("documents.uploadHint")}</p>

      {showForm && (
        <form onSubmit={handleUpload} className="card-flat">
          <section
            aria-label={t("documents.chooseFile")}
            className={`doc-dropzone${dragOver ? " doc-dropzone--over" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
          >
            <input
              ref={inputRef}
              id="doc-file"
              type="file"
              style={{ display: "none" }}
              onChange={(e) => pick(e.target.files?.[0])}
            />
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => inputRef.current?.click()}
            >
              {t("documents.chooseFile")}
            </button>
            <span className="muted text-sm">
              {file ? `${file.name} · ${fmtSize(file.size)}` : t("documents.dropHint")}
            </span>
          </section>
          <div className="field">
            <label className="label" htmlFor="doc-vis">
              {t("documents.fieldVisibility")}
            </label>
            <select
              id="doc-vis"
              className="select"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as DocumentVisibility)}
            >
              {DOCUMENT_VISIBILITIES.map((v) => (
                <option key={v} value={v}>
                  {t(`documents.visibility.${v}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="form-actions">
            <button
              type="submit"
              disabled={!file || uploadMut.isPending}
              className="btn btn-primary"
            >
              {uploadMut.isPending ? "…" : t("documents.upload")}
            </button>
            {errorText && <span className="err-msg">{errorText}</span>}
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
                <td className="text-bold">
                  {doc.hasFile ? (
                    <a href={apiUrl(`/documents/${doc.id}/file`)} target="_blank" rel="noreferrer">
                      {doc.name}
                    </a>
                  ) : (
                    <>
                      {doc.name} <span className="muted text-xs">({t("documents.noFile")})</span>
                    </>
                  )}
                </td>
                <td className="muted text-sm">{doc.mimeType}</td>
                <td style={{ textAlign: "right" }}>{doc.hasFile ? fmtSize(doc.fileSize) : "–"}</td>
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
                      onClick={() => {
                        if (window.confirm(t("documents.deleteConfirm"))) deleteMut.mutate(doc.id);
                      }}
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
