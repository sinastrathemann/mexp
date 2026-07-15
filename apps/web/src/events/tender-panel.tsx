import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";
import { useAuth } from "../auth/auth-context";
import type { EventDto, TenderCriterion, TenderDto, TenderStatus, VendorDto } from "./types";

interface Props {
  event: EventDto;
}

const STATUS_BADGE: Record<TenderStatus, { class: string; label: string }> = {
  draft: { class: "badge badge-outline", label: "Entwurf" },
  published: { class: "badge badge-orange", label: "Veröffentlicht" },
  closed: { class: "badge badge-ink", label: "Geschlossen" },
  awarded: { class: "badge badge-success", label: "Vergeben" },
};

export function TenderPanel({ event }: Props) {
  const { hasRole } = useAuth();
  const qc = useQueryClient();
  const canManage = hasRole("admin", "manager", "event_office", "werkstudent");

  const tendersQ = useQuery({
    queryKey: ["tenders", event.id],
    queryFn: () => apiFetch<{ tenders: TenderDto[] }>(`/tenders?eventId=${event.id}`),
    enabled: canManage,
  });

  const createMut = useMutation({
    mutationFn: (body: unknown) =>
      apiFetch<{ tender: TenderDto }>("/tenders", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tenders", event.id] }),
  });

  if (!canManage) return null;

  const tenders = tendersQ.data?.tenders ?? [];

  return (
    <section className="card">
      <div className="card-header">
        <div>
          <h2 className="card-title">Ausschreibungen</h2>
          <p className="muted text-sm" style={{ margin: "4px 0 0" }}>
            Externe Anbieter einladen, Angebote vergleichen und bewerten.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={createMut.isPending}
          onClick={() =>
            createMut.mutate({
              eventId: event.id,
              title: `Ausschreibung — ${event.title}`,
              briefing: "",
              deadline: null,
              criteria: [
                { label: "Preis", weight: 40 },
                { label: "Qualität", weight: 30 },
                { label: "Erfahrung / Referenzen", weight: 20 },
                { label: "Nachhaltigkeit", weight: 10 },
              ],
            })
          }
        >
          + Neue Ausschreibung
        </button>
      </div>

      {createMut.error instanceof Error && (
        <div className="alert alert-error">{createMut.error.message}</div>
      )}

      {tendersQ.isLoading && <p className="muted">Lädt…</p>}

      {!tendersQ.isLoading && tenders.length === 0 && (
        <p className="muted">
          Noch keine Ausschreibung. Lege eine an, um externe Anbieter (Catering, Location, Agentur)
          Angebote einreichen zu lassen.
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        {tenders.map((t) => (
          <TenderEditor key={t.id} tender={t} eventId={event.id} />
        ))}
      </div>
    </section>
  );
}

function TenderEditor({ tender, eventId }: { tender: TenderDto; eventId: string }) {
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const canDelete = hasRole("admin");

  const [title, setTitle] = useState(tender.title);
  const [briefing, setBriefing] = useState(tender.briefing);
  const [deadline, setDeadline] = useState(tender.deadline ? toLocalInput(tender.deadline) : "");
  const [criteria, setCriteria] = useState<TenderCriterion[]>(tender.criteria);
  const [status, setStatus] = useState<TenderStatus>(tender.status);
  const [expanded, setExpanded] = useState(false);

  // Bei externem Update (z.B. anderer Tab) Felder mitziehen
  useEffect(() => {
    setTitle(tender.title);
    setBriefing(tender.briefing);
    setDeadline(tender.deadline ? toLocalInput(tender.deadline) : "");
    setCriteria(tender.criteria);
    setStatus(tender.status);
  }, [tender]);

  const saveMut = useMutation({
    mutationFn: (body: unknown) =>
      apiFetch<{ tender: TenderDto }>(`/tenders/${tender.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tenders", eventId] }),
  });

  const deleteMut = useMutation({
    mutationFn: () => apiFetch<{ ok: true }>(`/tenders/${tender.id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tenders", eventId] }),
  });

  const weightSum = criteria.reduce((sum, c) => sum + (Number(c.weight) || 0), 0);
  const weightWarning = criteria.length > 0 && Math.round(weightSum) !== 100;

  const meta = STATUS_BADGE[tender.status];

  const handleSave = () => {
    saveMut.mutate({
      title: title.trim(),
      briefing,
      deadline: deadline ? new Date(deadline).toISOString() : null,
      criteria,
      status,
    });
  };

  return (
    <div className="card-flat" style={{ margin: 0 }}>
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div style={{ flex: "1 1 auto", minWidth: 0 }}>
          <span className={meta.class}>{meta.label}</span>{" "}
          <span className="text-bold" style={{ marginLeft: 8 }}>
            {tender.title}
          </span>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Schließen" : "Bearbeiten"}
        </button>
      </div>

      {!expanded && (
        <div className="muted text-sm" style={{ marginTop: 6 }}>
          {tender.criteria.length} Kriterien
          {tender.deadline &&
            ` · Deadline ${new Date(tender.deadline).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })}`}
        </div>
      )}

      {expanded && (
        <div style={{ marginTop: "var(--space-3)", display: "grid", gap: "var(--space-3)" }}>
          <div className="field" style={{ margin: 0 }}>
            <label className="label" htmlFor="tender-title">
              Titel
            </label>
            <input
              id="tender-title"
              className="input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="field" style={{ margin: 0 }}>
            <label className="label" htmlFor="tender-briefing">
              Briefing für Anbieter
            </label>
            <textarea
              id="tender-briefing"
              className="textarea"
              rows={6}
              value={briefing}
              onChange={(e) => setBriefing(e.target.value)}
              placeholder="Beschreibe die Anforderungen — was sollen die Anbieter genau anbieten? Ort, Datum, Teilnehmerzahl, besondere Wünsche, Lieferumfang …"
            />
          </div>

          <div className="field-row">
            <div className="field" style={{ margin: 0 }}>
              <label className="label" htmlFor="tender-deadline">
                Deadline für Angebote
              </label>
              <input
                id="tender-deadline"
                className="input"
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label className="label" htmlFor="tender-status">
                Status
              </label>
              <select
                id="tender-status"
                className="select"
                value={status}
                onChange={(e) => setStatus(e.target.value as TenderStatus)}
              >
                <option value="draft">Entwurf</option>
                <option value="published">Veröffentlicht</option>
                <option value="closed">Geschlossen</option>
                <option value="awarded">Vergeben</option>
              </select>
            </div>
          </div>

          <fieldset
            style={{
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-md)",
              padding: "var(--space-3) var(--space-4)",
              margin: 0,
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
              Bewertungs-Kriterien (Σ = 100%)
            </legend>
            {criteria.map((c, idx) => (
              <div
                key={`criterion-${idx}-${c.label}`}
                className="row"
                style={{ gap: 8, marginBottom: 6, alignItems: "center" }}
              >
                <input
                  className="input"
                  type="text"
                  value={c.label}
                  onChange={(e) => {
                    const next = [...criteria];
                    const cur = next[idx];
                    if (!cur) return;
                    next[idx] = { label: e.target.value, weight: cur.weight };
                    setCriteria(next);
                  }}
                  style={{ flex: 1 }}
                />
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={100}
                  value={c.weight}
                  onChange={(e) => {
                    const next = [...criteria];
                    const cur = next[idx];
                    if (!cur) return;
                    next[idx] = { label: cur.label, weight: Number(e.target.value) || 0 };
                    setCriteria(next);
                  }}
                  style={{ width: 80 }}
                />
                <span className="muted text-xs" style={{ minWidth: 16 }}>
                  %
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setCriteria(criteria.filter((_, i) => i !== idx))}
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setCriteria([...criteria, { label: "", weight: 0 }])}
            >
              + Kriterium
            </button>
            <div
              className="text-mono text-xs"
              style={{
                marginTop: 8,
                color: weightWarning ? "var(--brand-orange)" : "var(--fg-muted)",
              }}
            >
              Σ Gewichtung: {weightSum}%{weightWarning && " — bitte auf 100% summieren"}
            </div>
          </fieldset>

          {saveMut.error instanceof Error && (
            <div className="alert alert-error">{saveMut.error.message}</div>
          )}
          {saveMut.isSuccess && <div className="alert alert-info">✓ Gespeichert.</div>}

          <div className="row" style={{ gap: 8, justifyContent: "space-between" }}>
            <div className="row" style={{ gap: 8 }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleSave}
                disabled={saveMut.isPending}
              >
                {saveMut.isPending ? "Speichere…" : "Speichern"}
              </button>
              <span className="muted text-sm" style={{ alignSelf: "center" }}>
                {tender.status === "draft" && "Anbieter können noch nichts sehen."}
                {tender.status === "published" && "Anbieter können Angebote einreichen."}
              </span>
            </div>
            {canDelete && (
              <button
                type="button"
                className="btn btn-danger btn-sm"
                disabled={deleteMut.isPending}
                onClick={() => {
                  if (window.confirm("Ausschreibung wirklich löschen?")) {
                    deleteMut.mutate();
                  }
                }}
              >
                🗑 Löschen
              </button>
            )}
          </div>

          <VendorList tenderId={tender.id} />
          <QnaAdminList tenderId={tender.id} />

          <p className="muted text-xs" style={{ margin: 0 }}>
            Q&A + Angebots-Upload + KI-Bewertung folgen in den nächsten Phasen.
          </p>
        </div>
      )}
    </div>
  );
}

function VendorList({ tenderId }: { tenderId: string }) {
  const qc = useQueryClient();
  const [showInvite, setShowInvite] = useState(false);
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const vendorsQ = useQuery({
    queryKey: ["vendors", tenderId],
    queryFn: () => apiFetch<{ vendors: VendorDto[] }>(`/vendors/admin?tenderId=${tenderId}`),
  });

  const inviteMut = useMutation({
    mutationFn: (body: unknown) =>
      apiFetch<{ vendor: VendorDto; magicLink: string }>("/vendors/admin/invite", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      setEmail("");
      setCompanyName("");
      setContactName("");
      setShowInvite(false);
      qc.invalidateQueries({ queryKey: ["vendors", tenderId] });
    },
  });

  const revokeMut = useMutation({
    mutationFn: (vendorId: string) =>
      apiFetch<{ ok: true }>(`/vendors/admin/${vendorId}/revoke`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vendors", tenderId] }),
  });

  const vendors = vendorsQ.data?.vendors ?? [];

  const buildLink = (token: string) => {
    return `${window.location.origin}/vendor?token=${token}`;
  };

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <fieldset
      style={{
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-3) var(--space-4)",
        margin: 0,
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
        Eingeladene Anbieter ({vendors.filter((v) => !v.revoked).length})
      </legend>

      {vendors.length === 0 && (
        <p className="muted text-sm" style={{ margin: "4px 0 8px" }}>
          Noch keine Anbieter eingeladen.
        </p>
      )}

      {vendors.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
          {vendors.map((v) => {
            const link = buildLink(v.magicToken);
            return (
              <div
                key={v.id}
                className="row"
                style={{
                  padding: "6px 10px",
                  background: v.revoked ? "var(--bg-muted)" : "var(--bg-default)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "var(--radius-base)",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                  <span
                    className="text-bold"
                    style={{ textDecoration: v.revoked ? "line-through" : "none" }}
                  >
                    {v.companyName}
                  </span>
                  <span className="muted text-xs" style={{ marginLeft: 6 }}>
                    · {v.email}
                  </span>
                  {v.contactName && (
                    <span className="muted text-xs" style={{ marginLeft: 6 }}>
                      · {v.contactName}
                    </span>
                  )}
                  {v.lastAccessAt && (
                    <span
                      className="text-mono text-xs"
                      style={{ marginLeft: 6, color: "var(--brand-lime)" }}
                    >
                      · zuletzt: {new Date(v.lastAccessAt).toLocaleString("de-DE")}
                    </span>
                  )}
                </div>
                {!v.revoked && (
                  <>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => copy(link, v.id)}
                    >
                      {copied === v.id ? "✓ Kopiert" : "🔗 Link kopieren"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={revokeMut.isPending}
                      onClick={() => {
                        if (window.confirm(`Zugang für "${v.companyName}" wirklich widerrufen?`)) {
                          revokeMut.mutate(v.id);
                        }
                      }}
                    >
                      Widerrufen
                    </button>
                  </>
                )}
                {v.revoked && <span className="badge badge-muted">widerrufen</span>}
              </div>
            );
          })}
        </div>
      )}

      {!showInvite && (
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => setShowInvite(true)}
        >
          + Anbieter einladen
        </button>
      )}

      {showInvite && (
        <div
          style={{
            marginTop: 8,
            padding: "var(--space-2) var(--space-3)",
            background: "var(--bg-subtle)",
            borderRadius: "var(--radius-base)",
          }}
        >
          <div className="field-row" style={{ gap: 8 }}>
            <div className="field" style={{ margin: 0 }}>
              <label className="label" htmlFor="tender-company">
                Firma
              </label>
              <input
                id="tender-company"
                className="input"
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="z.B. Heidewald Catering GmbH"
                required
              />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label className="label" htmlFor="tender-email">
                E-Mail
              </label>
              <input
                id="tender-email"
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="kontakt@anbieter.de"
                required
              />
            </div>
          </div>
          <div className="field" style={{ margin: "8px 0 0" }}>
            <label className="label" htmlFor="tender-contact">
              Ansprechpartner (optional)
            </label>
            <input
              id="tender-contact"
              className="input"
              type="text"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="z.B. Hans Müller"
            />
          </div>
          {inviteMut.error instanceof Error && (
            <div className="alert alert-error" style={{ marginTop: 8 }}>
              {inviteMut.error.message}
            </div>
          )}
          <div className="row" style={{ gap: 8, marginTop: 8 }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={inviteMut.isPending || !email.trim() || !companyName.trim()}
              onClick={() =>
                inviteMut.mutate({
                  tenderId,
                  email: email.trim(),
                  companyName: companyName.trim(),
                  contactName: contactName.trim(),
                })
              }
            >
              {inviteMut.isPending ? "Lade ein…" : "Einladen"}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setShowInvite(false)}
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </fieldset>
  );
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface QnaItem {
  id: string;
  question: string;
  askedAt: string;
  answer: string | null;
  answeredAt: string | null;
  askerLabel: string;
  askerVendorId: string | null;
}

function QnaAdminList({ tenderId }: { tenderId: string }) {
  const qc = useQueryClient();
  const qnaQ = useQuery({
    queryKey: ["qna", "admin", tenderId],
    queryFn: () => apiFetch<{ items: QnaItem[] }>(`/tenders/${tenderId}/qna/admin`),
  });

  const items = qnaQ.data?.items ?? [];
  const unanswered = items.filter((q) => !q.answer).length;

  return (
    <fieldset
      style={{
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-3) var(--space-4)",
        margin: 0,
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
        Q&A ({items.length})
        {unanswered > 0 && (
          <span className="badge badge-orange" style={{ marginLeft: 6 }}>
            {unanswered} offen
          </span>
        )}
      </legend>

      {items.length === 0 && (
        <p className="muted text-sm" style={{ margin: "4px 0 0" }}>
          Noch keine Fragen. Anbieter können Fragen über ihre Landingpage stellen.
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
        {items.map((q) => (
          <QnaAdminItem
            key={q.id}
            qna={q}
            tenderId={tenderId}
            onChange={() => qc.invalidateQueries({ queryKey: ["qna", "admin", tenderId] })}
          />
        ))}
      </div>
    </fieldset>
  );
}

function QnaAdminItem({
  qna,
  tenderId,
  onChange,
}: {
  qna: QnaItem;
  tenderId: string;
  onChange: () => void;
}) {
  const [draft, setDraft] = useState(qna.answer ?? "");
  const [editing, setEditing] = useState(!qna.answer);

  const answerMut = useMutation({
    mutationFn: (answer: string) =>
      apiFetch<{ item: QnaItem }>(`/tenders/${tenderId}/qna/${qna.id}/answer`, {
        method: "POST",
        body: JSON.stringify({ answer }),
      }),
    onSuccess: () => {
      setEditing(false);
      onChange();
    },
  });

  const clearMut = useMutation({
    mutationFn: () =>
      apiFetch<{ ok: true }>(`/tenders/${tenderId}/qna/${qna.id}/answer`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      setDraft("");
      setEditing(true);
      onChange();
    },
  });

  return (
    <div
      style={{
        padding: "var(--space-2) var(--space-3)",
        background: "var(--bg-default)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-base)",
      }}
    >
      <div className="row" style={{ justifyContent: "space-between", gap: 8 }}>
        <span className="text-bold">{qna.askerLabel}</span>
        <span className="muted text-xs">
          {new Date(qna.askedAt).toLocaleString("de-DE", {
            dateStyle: "short",
            timeStyle: "short",
          })}
        </span>
      </div>
      <p style={{ margin: "4px 0 0", whiteSpace: "pre-wrap" }}>{qna.question}</p>

      {qna.answer && !editing && (
        <div
          style={{
            marginTop: 8,
            padding: "8px 10px",
            background: "var(--bg-subtle)",
            borderLeft: "3px solid var(--brand-lime)",
            borderRadius: "var(--radius-base)",
          }}
        >
          <div className="text-mono text-xs muted" style={{ marginBottom: 4 }}>
            ✓ Antwort ·{" "}
            {qna.answeredAt &&
              new Date(qna.answeredAt).toLocaleString("de-DE", {
                dateStyle: "short",
                timeStyle: "short",
              })}
          </div>
          <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{qna.answer}</p>
          <div className="row" style={{ gap: 6, marginTop: 6 }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>
              ✎ Bearbeiten
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={clearMut.isPending}
              onClick={() => {
                if (window.confirm("Antwort zurücknehmen? Anbieter sehen sie dann nicht mehr.")) {
                  clearMut.mutate();
                }
              }}
            >
              Zurücknehmen
            </button>
          </div>
        </div>
      )}

      {editing && (
        <div style={{ marginTop: 8 }}>
          <textarea
            className="textarea"
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Antwort an alle Anbieter (sichtbar für alle, ohne Firmen-Zuordnung)…"
          />
          {answerMut.error instanceof Error && (
            <div className="alert alert-error" style={{ marginTop: 6 }}>
              {answerMut.error.message}
            </div>
          )}
          <div className="row" style={{ gap: 6, marginTop: 6 }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={answerMut.isPending || draft.trim().length === 0}
              onClick={() => answerMut.mutate(draft.trim())}
            >
              {answerMut.isPending
                ? "Speichere…"
                : qna.answer
                  ? "Antwort aktualisieren"
                  : "Antworten"}
            </button>
            {qna.answer && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setDraft(qna.answer ?? "");
                  setEditing(false);
                }}
              >
                Abbrechen
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
