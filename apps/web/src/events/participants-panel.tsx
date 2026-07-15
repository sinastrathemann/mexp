import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiRequestError, apiFetch } from "../api/client";
import { useAuth } from "../auth/auth-context";
import { RegistrationModal } from "./registration-modal";
import type {
  EventDto,
  ParticipantDto,
  ParticipationDto,
  RegistrationAnswer,
  RegistrationQuestion,
} from "./types";

interface ParticipantsPanelProps {
  event: EventDto;
}

export function ParticipantsPanel({ event }: ParticipantsPanelProps) {
  const { t, i18n } = useTranslation();
  const { user, hasRole } = useAuth();
  const qc = useQueryClient();
  const canManage = hasRole("admin", "manager", "event_office", "werkstudent");
  const registrationOpen = event.status === "open";
  const [modalOpen, setModalOpen] = useState(false);

  // Anmelde-Formular-Fragen für dieses Event
  const formQ = useQuery({
    queryKey: ["events", event.id, "registration-form"],
    queryFn: () =>
      apiFetch<{ questions: RegistrationQuestion[] }>(`/events/${event.id}/registration-form`),
  });
  const questions: RegistrationQuestion[] = formQ.data?.questions ?? [];

  const participantsQ = useQuery({
    queryKey: ["events", event.id, "participants"],
    queryFn: () => apiFetch<{ participants: ParticipantDto[] }>(`/events/${event.id}/participants`),
    enabled: canManage,
  });

  const myParticipationQ = useQuery({
    queryKey: ["events", event.id, "my-participation"],
    queryFn: () =>
      apiFetch<{ participation: ParticipationDto | null }>(`/events/${event.id}/my-participation`),
    enabled: !canManage && Boolean(user),
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["events", event.id, "participants"] });
    qc.invalidateQueries({ queryKey: ["events", event.id, "my-participation"] });
  };

  const registerMut = useMutation({
    mutationFn: (input: {
      answers: RegistrationAnswer[];
      personalNote: string | null;
    }) =>
      apiFetch<{ participation: ParticipationDto }>(`/events/${event.id}/register`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      setModalOpen(false);
      invalidateAll();
    },
  });

  const handleRegisterClick = () => {
    if (questions.length === 0) {
      // Direkter Register-Click ohne Fragen — Modal trotzdem öffnen, um Notiz erfassen zu können
      setModalOpen(true);
    } else {
      setModalOpen(true);
    }
  };

  const updateNoteMut = useMutation({
    mutationFn: (personalNote: string | null) =>
      apiFetch<{ participation: ParticipationDto }>(`/events/${event.id}/my-participation`, {
        method: "PATCH",
        body: JSON.stringify({ personalNote }),
      }),
    onSuccess: () => invalidateAll(),
  });

  const withdrawMut = useMutation({
    mutationFn: () =>
      apiFetch<{ participation: ParticipationDto }>(`/events/${event.id}/withdraw`, {
        method: "POST",
      }),
    onSuccess: invalidateAll,
  });

  const promoteMut = useMutation({
    mutationFn: () =>
      apiFetch<{ participation: ParticipationDto }>(
        `/events/${event.id}/participants/promote-waitlist`,
        { method: "POST" },
      ),
    onSuccess: invalidateAll,
  });

  const checkInMut = useMutation({
    mutationFn: (participationId: string) =>
      apiFetch<{ participation: ParticipationDto }>(
        `/events/${event.id}/participants/${participationId}/check-in`,
        { method: "POST" },
      ),
    onSuccess: invalidateAll,
  });

  const noShowMut = useMutation({
    mutationFn: (participationId: string) =>
      apiFetch<{ participation: ParticipationDto }>(
        `/events/${event.id}/participants/${participationId}/no-show`,
        { method: "POST" },
      ),
    onSuccess: invalidateAll,
  });

  const participants = participantsQ.data?.participants ?? [];
  const ownFromList = user ? participants.find((p) => p.userId === user.id) : undefined;
  const ownFromSelf = myParticipationQ.data?.participation ?? undefined;
  const own: ParticipationDto | undefined = ownFromList ?? ownFromSelf ?? undefined;
  const activeCount = participants.filter((p) => p.status === "registered").length;
  const waitlistCount = participants.filter((p) => p.status === "waitlisted").length;
  const attendedCount = participants.filter((p) => p.status === "attended").length;
  const noShowCount = participants.filter((p) => p.status === "no_show").length;
  const checkInPhase = event.status === "open" || event.status === "running";
  const noShowPhase = event.status === "running" || event.status === "closed";

  const [searchTerm, setSearchTerm] = useState("");
  const filteredParticipants = searchTerm.trim()
    ? participants.filter((p) => {
        const q = searchTerm.toLowerCase();
        return p.userDisplayName.toLowerCase().includes(q) || p.userEmail.toLowerCase().includes(q);
      })
    : participants;

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString(i18n.language === "de" ? "de-DE" : "en-US", {
      dateStyle: "short",
      timeStyle: "short",
    });

  const ownForSelfActions = own;

  return (
    <section className="card">
      <h2 className="card-title">{t("participants.sectionTitle")}</h2>

      {canManage && (
        <p className="muted" style={{ marginTop: 0 }}>
          {t("participants.count", { count: activeCount })}
          {event.capacity !== null && ` / ${event.capacity}`}
          {waitlistCount > 0 && ` · ${t("participants.waitlistCount", { count: waitlistCount })}`}
          {attendedCount > 0 && ` · ${t("participants.attendedCount", { count: attendedCount })}`}
          {noShowCount > 0 && ` · ${t("participants.noShowCount", { count: noShowCount })}`}
        </p>
      )}

      <SelfActions
        registrationOpen={registrationOpen}
        eventStatus={event.status}
        own={ownForSelfActions}
        registerPending={registerMut.isPending}
        withdrawPending={withdrawMut.isPending}
        registerError={registerMut.error}
        withdrawError={withdrawMut.error}
        onRegister={handleRegisterClick}
        onWithdraw={() => withdrawMut.mutate()}
      />

      {own && own.status !== "cancelled" && own.status !== "no_show" && (
        <MyNoteBlock
          note={own.personalNote ?? null}
          pending={updateNoteMut.isPending}
          onSave={(text) => updateNoteMut.mutate(text)}
          error={updateNoteMut.error instanceof Error ? updateNoteMut.error.message : null}
        />
      )}

      {modalOpen && (
        <RegistrationModal
          eventTitle={event.title}
          questions={questions}
          pending={registerMut.isPending}
          error={registerMut.error instanceof Error ? registerMut.error.message : null}
          onCancel={() => setModalOpen(false)}
          onSubmit={(answers, personalNote) => registerMut.mutate({ answers, personalNote })}
        />
      )}

      {canManage && (
        <>
          <div className="row" style={{ marginTop: "var(--space-4)" }}>
            <a
              href={`/api/events/${event.id}/participants.csv`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-outline btn-sm"
            >
              {t("participants.exportCsv")}
            </a>
            <a
              href={`/api/events/${event.id}/emergency-list`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-outline btn-sm"
            >
              {t("participants.emergencyList")}
            </a>
            {waitlistCount > 0 && event.capacity !== null && activeCount < event.capacity && (
              <button
                type="button"
                disabled={promoteMut.isPending}
                onClick={() => promoteMut.mutate()}
                className="btn btn-yellow btn-sm"
              >
                {promoteMut.isPending
                  ? t("participants.promoting")
                  : t("participants.promoteWaitlist")}
              </button>
            )}
          </div>
          {promoteMut.error instanceof Error && (
            <div className="alert alert-error" style={{ marginTop: "var(--space-2)" }}>
              {promoteMut.error.message}
            </div>
          )}

          <div style={{ marginTop: "var(--space-4)", overflowX: "auto" }}>
            {participants.length === 0 ? (
              <p className="muted">{t("participants.empty")}</p>
            ) : (
              <>
                <div className="row" style={{ marginBottom: "var(--space-3)" }}>
                  <input
                    type="search"
                    className="input"
                    placeholder="🔍 Nach Name oder E-Mail suchen…"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ maxWidth: 360 }}
                  />
                  {searchTerm && (
                    <span className="muted text-sm">
                      {filteredParticipants.length} / {participants.length}
                    </span>
                  )}
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t("participants.colName")}</th>
                      <th>{t("participants.colEmail")}</th>
                      <th>{t("participants.colStatus")}</th>
                      <th>{t("participants.colPosition")}</th>
                      <th>{t("participants.colRegisteredAt")}</th>
                      {questions.length > 0 && <th>Antworten</th>}
                      <th>Notiz</th>
                      <th>{t("participants.colActions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredParticipants.map((p) => (
                      <tr key={p.id}>
                        <td className="text-bold">
                          {p.userDisplayName}
                          {p.personalNote && (
                            <span
                              title={p.personalNote}
                              style={{ marginLeft: 6, fontSize: "0.85em" }}
                            >
                              📝
                            </span>
                          )}
                        </td>
                        <td className="muted">{p.userEmail}</td>
                        <td>
                          <span className="badge badge-muted">
                            {t(`participants.status.${p.status}`)}
                          </span>
                        </td>
                        <td>{p.waitlistPosition ?? "—"}</td>
                        <td className="text-sm muted">{fmtDate(p.registeredAt)}</td>
                        {questions.length > 0 && (
                          <td>
                            <AnswerSummary questions={questions} answers={p.answers ?? []} />
                          </td>
                        )}
                        <td style={{ maxWidth: 200 }}>
                          {p.personalNote ? (
                            <span
                              style={{
                                whiteSpace: "pre-wrap",
                                fontSize: "var(--text-xs)",
                                color: "var(--fg-strong)",
                              }}
                            >
                              {p.personalNote}
                            </span>
                          ) : (
                            <span className="muted text-xs">—</span>
                          )}
                        </td>
                        <td>
                          <div className="row" style={{ gap: "var(--space-2)" }}>
                            {p.status === "registered" && checkInPhase && (
                              <button
                                type="button"
                                disabled={checkInMut.isPending}
                                onClick={() => checkInMut.mutate(p.id)}
                                className="btn btn-outline-orange btn-sm"
                              >
                                {t("participants.checkIn")}
                              </button>
                            )}
                            {p.status === "registered" && noShowPhase && (
                              <button
                                type="button"
                                disabled={noShowMut.isPending}
                                onClick={() => noShowMut.mutate(p.id)}
                                className="btn btn-ghost btn-sm"
                              >
                                {t("participants.markNoShow")}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
}

interface SelfActionsProps {
  registrationOpen: boolean;
  eventStatus: string;
  own: ParticipationDto | undefined;
  registerPending: boolean;
  withdrawPending: boolean;
  registerError: unknown;
  withdrawError: unknown;
  onRegister: () => void;
  onWithdraw: () => void;
}

function SelfActions(props: SelfActionsProps) {
  const { t } = useTranslation();
  const {
    registrationOpen,
    eventStatus,
    own,
    registerPending,
    withdrawPending,
    registerError,
    withdrawError,
    onRegister,
    onWithdraw,
  } = props;

  const ownActive = own && (own.status === "registered" || own.status === "waitlisted");

  if (ownActive) {
    return (
      <div style={{ marginTop: "var(--space-3)" }}>
        {own.status === "registered" ? (
          <div
            className="alert alert-info"
            style={{ borderColor: "var(--brand-yellow)", background: "var(--brand-yellow-light)" }}
          >
            {t("participants.yourStatusRegistered")}
          </div>
        ) : (
          <div className="alert alert-info">
            {t("participants.yourStatusWaitlisted", { position: own.waitlistPosition ?? "?" })}
          </div>
        )}
        <button
          type="button"
          disabled={withdrawPending}
          onClick={onWithdraw}
          className="btn btn-outline"
        >
          {withdrawPending ? t("participants.withdrawing") : t("participants.withdraw")}
        </button>
        {withdrawError instanceof ApiRequestError && (
          <div className="alert alert-error" style={{ marginTop: "var(--space-2)" }}>
            {withdrawError.message}
          </div>
        )}
      </div>
    );
  }

  if (!registrationOpen) {
    return (
      <p className="muted" style={{ marginTop: "var(--space-3)" }}>
        {t("participants.registrationClosed", { status: t(`events.status.${eventStatus}`) })}
      </p>
    );
  }

  return (
    <div style={{ marginTop: "var(--space-3)" }}>
      <button
        type="button"
        disabled={registerPending}
        onClick={onRegister}
        className="btn btn-primary"
      >
        {registerPending ? t("participants.registering") : t("participants.register")}
      </button>
      {registerError instanceof ApiRequestError && (
        <div className="alert alert-error" style={{ marginTop: "var(--space-2)" }}>
          {registerError.message}
        </div>
      )}
    </div>
  );
}

function AnswerSummary({
  questions,
  answers,
}: {
  questions: RegistrationQuestion[];
  answers: RegistrationAnswer[];
}) {
  if (!answers || answers.length === 0) {
    return <span className="muted text-xs">—</span>;
  }
  const byId = new Map(answers.map((a) => [a.questionId, a]));
  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });
  };
  const format = (q: RegistrationQuestion): string => {
    const a = byId.get(q.id);
    if (!a || a.value === null || a.value === "") return "—";
    if (q.type === "yes_no") return a.value === true ? "Ja" : a.value === false ? "Nein" : "—";
    if (q.type === "single_choice" && typeof a.value === "string") return a.value;
    if (q.type === "multi_choice" && Array.isArray(a.value)) return a.value.join(", ") || "—";
    if (q.type === "date_pick" && Array.isArray(a.value)) {
      return a.value.map(fmtDate).join(" · ") || "—";
    }
    return "—";
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: "var(--text-xs)" }}>
      {questions.map((q) => (
        <div key={q.id} style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
          <span className="text-mono muted" style={{ fontSize: 10, minWidth: 90 }}>
            {q.label.length > 18 ? `${q.label.slice(0, 16)}…` : q.label}:
          </span>
          <span className="text-bold">{format(q)}</span>
        </div>
      ))}
    </div>
  );
}

function MyNoteBlock({
  note,
  pending,
  error,
  onSave,
}: {
  note: string | null;
  pending: boolean;
  error: string | null;
  onSave: (text: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(note ?? "");

  const startEdit = () => {
    setDraft(note ?? "");
    setEditing(true);
  };
  const save = () => {
    const trimmed = draft.trim();
    onSave(trimmed === "" ? null : trimmed);
    setEditing(false);
  };
  const cancel = () => {
    setDraft(note ?? "");
    setEditing(false);
  };

  return (
    <div
      style={{
        marginTop: "var(--space-3)",
        padding: "var(--space-3) var(--space-4)",
        background: "var(--bg-subtle)",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--border-default)",
      }}
    >
      <div
        className="row"
        style={{ justifyContent: "space-between", marginBottom: editing || note ? 8 : 0 }}
      >
        <span
          className="text-mono text-xs"
          style={{
            letterSpacing: "var(--tracking-wider)",
            textTransform: "uppercase",
            color: "var(--fg-strong)",
            fontWeight: 700,
          }}
        >
          📝 Deine Notiz
        </span>
        {!editing && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={startEdit}>
            {note ? "✎ Bearbeiten" : "+ Notiz hinzufügen"}
          </button>
        )}
      </div>

      {!editing && note && (
        <p style={{ margin: 0, whiteSpace: "pre-wrap", color: "var(--fg-strong)" }}>{note}</p>
      )}
      {!editing && !note && (
        <p className="muted text-sm" style={{ margin: 0 }}>
          Noch keine Notiz. z. B. "komme mit Partner", "vegetarisch", "kann erst ab 15:30"
        </p>
      )}

      {editing && (
        <>
          <textarea
            className="textarea"
            rows={2}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder='z. B. "komme mit Partner"'
          />
          <div className="row" style={{ gap: 8, marginTop: 8 }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={save}
              disabled={pending}
            >
              {pending ? "Speichere…" : "Speichern"}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={cancel}
              disabled={pending}
            >
              Abbrechen
            </button>
          </div>
        </>
      )}
      {error && (
        <div className="alert alert-error" style={{ marginTop: 8 }}>
          {error}
        </div>
      )}
    </div>
  );
}
