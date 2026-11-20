import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type DragEvent, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiRequestError, apiFetch, apiUpload, apiUrl } from "../api/client";
import { useAuth } from "../auth/auth-context";
import { mergeFiles, partitionBySize } from "./doc-upload-utils";
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
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<string | null>(null);
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
    setFiles([]);
    setProgress(null);
    setVisibility("event_staff");
    setLocalError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  // Mehrere Dateien nacheinander hochladen; bei Fehler stoppen, Rest bleibt ausgewählt
  const uploadMut = useMutation({
    mutationFn: async (list: File[]) => {
      for (const [i, f] of list.entries()) {
        setProgress(`${i + 1}/${list.length}`);
        const body = new FormData();
        body.append("file", f);
        body.append("visibility", visibility);
        try {
          await apiUpload<{ document: DocumentDto }>(`/events/${event.id}/documents/upload`, body);
        } catch (err) {
          setFiles(list.slice(i));
          if (err instanceof Error) err.message = `${f.name}: ${err.message}`;
          throw err;
        }
      }
    },
    onSuccess: () => {
      reset();
      setShowForm(false);
    },
    onSettled: () => {
      setProgress(null);
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

  const pick = (list: FileList | null | undefined) => {
    uploadMut.reset();
    if (!list || list.length === 0) return;
    const { ok, tooLarge } = partitionBySize(Array.from(list), MAX_UPLOAD_BYTES);
    setLocalError(
      tooLarge.length > 0
        ? `${t("documents.tooLarge")} (${tooLarge.map((f) => f.name).join(", ")})`
        : null,
    );
    setFiles((cur) => mergeFiles(cur, ok));
    if (inputRef.current) inputRef.current.value = "";
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    pick(e.dataTransfer.files);
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
    if (files.length === 0) return;
    uploadMut.mutate(files);
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
              multiple
              style={{ display: "none" }}
              onChange={(e) => pick(e.target.files)}
            />
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => inputRef.current?.click()}
            >
              {t("documents.chooseFile")}
            </button>
            {files.length === 0 && <span className="muted text-sm">{t("documents.dropHint")}</span>}
            {files.length > 0 && (
              <ul className="doc-file-list">
                {files.map((f) => (
                  <li key={`${f.name}|${f.size}`}>
                    <span className="text-sm">
                      {f.name} <span className="muted">· {fmtSize(f.size)}</span>
                    </span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      aria-label={`${t("documents.removeFile")}: ${f.name}`}
                      disabled={uploadMut.isPending}
                      onClick={() => setFiles((cur) => cur.filter((x) => x !== f))}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
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
              disabled={files.length === 0 || uploadMut.isPending}
              className="btn btn-primary"
            >
              {uploadMut.isPending
                ? `${t("documents.upload")} … ${progress ?? ""}`
                : files.length > 1
                  ? t("documents.uploadCount", { count: files.length })
                  : t("documents.upload")}
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
