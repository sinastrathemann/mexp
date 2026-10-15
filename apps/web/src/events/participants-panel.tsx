import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { ApiRequestError, apiFetch } from "../api/client";
import { useAuth } from "../auth/auth-context";
import { withBasePath } from "../base-path";
import { AddParticipantModal } from "./add-participant-modal";
import { RegistrationModal } from "./registration-modal";
import type {
  EventDto,
  ParticipantDto,
  ParticipationDto,
  RegistrationAnswer,
  RegistrationQuestion,
} from "./types";

// Status, die Admin/Werkstudent:innen in der Teilnehmerliste setzen können
const STAFF_STATUSES = ["registered", "waitlisted", "cancelled", "attended", "no_show"] as const;
type StaffStatus = (typeof STAFF_STATUSES)[number];

// Max. Anzahl Namen, die Nutzer ohne Verwaltungsrolle in der Teilnehmerliste sehen.
const PUBLIC_LIST_LIMIT = 12;

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
  const [addParticipantOpen, setAddParticipantOpen] = useState(false);
  const [editing, setEditing] = useState<ParticipantDto | null>(null);

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
    enabled: Boolean(event.id),
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

  // Admin/Werkstudent:in bearbeitet eine Anmeldung (Status, Notiz, Antworten)
  const editMut = useMutation({
    mutationFn: (input: {
      participationId: string;
      status?: StaffStatus;
      personalNote?: string | null;
      answers?: RegistrationAnswer[];
    }) => {
      const { participationId, ...body } = input;
      return apiFetch<{ participation: ParticipantDto }>(
        `/events/${event.id}/participants/${participationId}`,
        { method: "PATCH", body: JSON.stringify(body) },
      );
    },
    onSuccess: () => {
      setEditing(null);
      invalidateAll();
    },
  });

  const participants = participantsQ.data?.participants ?? [];
  const ownFromList = user ? participants.find((p) => p.userId === user.id) : undefined;
  const ownFromSelf = myParticipationQ.data?.participation ?? undefined;
  // Die eigene Anmeldung (mit Notiz) hat Vorrang: Nutzer ohne Verwaltungsrolle bekommen
  // in der Teilnehmerliste nur Name + Status, ohne persönliche Notiz.
  const own: ParticipationDto | undefined = ownFromSelf ?? ownFromList ?? undefined;

  // Anmeldelink (?anmelden=1): Anmeldeformular direkt öffnen, sobald feststeht, dass
  // die Person noch nicht angemeldet ist und die Anmeldung offen ist.
  const [searchParams, setSearchParams] = useSearchParams();
  const wantsRegistration = searchParams.get("anmelden") === "1";
  const sectionRef = useRef<HTMLElement>(null);
  const ownLoaded = canManage ? participantsQ.isSuccess : myParticipationQ.isSuccess;
  const deadlineOpen =
    !event.registrationDeadline || new Date(event.registrationDeadline).getTime() >= Date.now();
  useEffect(() => {
    if (!wantsRegistration || !ownLoaded || !formQ.isSuccess) return;
    const alreadyIn = own && own.status !== "cancelled";
    if (!alreadyIn && registrationOpen && deadlineOpen) setModalOpen(true);
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    const next = new URLSearchParams(searchParams);
    next.delete("anmelden");
    setSearchParams(next, { replace: true });
  }, [
    wantsRegistration,
    ownLoaded,
    formQ.isSuccess,
    own,
    registrationOpen,
    deadlineOpen,
    searchParams,
    setSearchParams,
  ]);
  const activeCount = participants.filter((p) => p.status === "registered").length;
  const waitlistCount = participants.filter((p) => p.status === "waitlisted").length;
  const attendedCount = participants.filter((p) => p.status === "attended").length;
  const noShowCount = participants.filter((p) => p.status === "no_show").length;
  const cancelledCount = participants.filter((p) => p.status === "cancelled").length;

  const visibleParticipants = participants.filter(
    (p) => p.status === "registered" || p.status === "waitlisted" || p.status === "attended",
  );

  const [searchTerm, setSearchTerm] = useState("");
  const filteredParticipants = searchTerm.trim()
    ? participants.filter((p) => {
        const q = searchTerm.toLowerCase();
        return p.userDisplayName.toLowerCase().includes(q) || (p.userEmail ?? "").toLowerCase().includes(q);
      })
    : participants;

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString(i18n.language === "de" ? "de-DE" : "en-US", {
      dateStyle: "short",
      timeStyle: "short",
    });

  const ownForSelfActions = own;

  return (
    <section className="card" ref={sectionRef}>
      <h2 className="card-title">{t("participants.sectionTitle")}</h2>

      <p className="muted" style={{ marginTop: 0 }}>
        {t("participants.count", { count: activeCount })}
        {event.capacity !== null && ` / ${event.capacity}`}
        {waitlistCount > 0 && ` · ${t("participants.waitlistCount", { count: waitlistCount })}`}
        {attendedCount > 0 && ` · ${t("participants.attendedCount", { count: attendedCount })}`}
        {noShowCount > 0 && ` · ${t("participants.noShowCount", { count: noShowCount })}`}
        {canManage &&
          cancelledCount > 0 &&
          ` · ${t("participants.cancelledCount", { count: cancelledCount })}`}
      </p>

      {!canManage && visibleParticipants.length > 0 && (
        <div
          className="card"
          style={{
            marginTop: "var(--space-3)",
            padding: "var(--space-3) var(--space-4)",
            background: "var(--bg-subtle)",
            border: "1px solid var(--border-default)",
          }}
        >
          <div
            className="text-xs"
            style={{ fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}
          >
            {t("participants.publicListTitle")}
          </div>
          <div className="row" style={{ marginTop: 8, flexWrap: "wrap", gap: 8 }}>
            {visibleParticipants.slice(0, PUBLIC_LIST_LIMIT).map((p) => (
              <span key={p.id} className="badge badge-muted">
                {p.userDisplayName}
              </span>
            ))}
          </div>
          {visibleParticipants.length > PUBLIC_LIST_LIMIT && (
            <div className="muted text-xs" style={{ marginTop: 8 }}>
              {t("participants.publicListMore", {
                count: visibleParticipants.length - PUBLIC_LIST_LIMIT,
              })}
            </div>
          )}
        </div>
      )}

      <SelfActions
        registrationOpen={registrationOpen}
        eventStatus={event.status}
        registrationDeadline={event.registrationDeadline ?? null}
        own={ownForSelfActions}
        registerPending={registerMut.isPending}
        withdrawPending={withdrawMut.isPending}
        registerError={registerMut.error}
        withdrawError={withdrawMut.error}
        onRegister={handleRegisterClick}
        onWithdraw={() => withdrawMut.mutate()}
      />

      {own && own.status !== "cancelled" && own.status !== "no_show" && (
        <div className="muted text-sm" style={{ marginTop: "var(--space-3)" }}>
          {own.personalNote && (
            <div style={{ whiteSpace: "pre-wrap", marginBottom: 4 }}>
              <strong>{t("participants.yourNote")}:</strong> {own.personalNote}
            </div>
          )}
          {t("participants.noChangesHint")}
        </div>
      )}

      {editing && (
        <RegistrationModal
          mode="edit"
          eventTitle={editing.userDisplayName}
          subtitle={event.title}
          questions={questions}
          initialAnswers={editing.answers ?? []}
          initialPersonalNote={editing.personalNote ?? ""}
          pending={editMut.isPending}
          error={editMut.error instanceof Error ? editMut.error.message : null}
          onCancel={() => setEditing(null)}
          onSubmit={(answers, personalNote) =>
            editMut.mutate({ participationId: editing.id, answers, personalNote })
          }
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

      {addParticipantOpen && (
        <AddParticipantModal
          eventId={event.id}
          eventTitle={event.title}
          onClose={() => setAddParticipantOpen(false)}
        />
      )}

      {canManage && (
        <>
          <div className="row" style={{ marginTop: "var(--space-4)" }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setAddParticipantOpen(true)}
            >
              {t("participants.addParticipant")}
            </button>
            <a
              href={withBasePath(`/api/events/${event.id}/participants.xlsx`)}
              className="btn btn-outline btn-sm"
            >
              {t("participants.exportExcel")}
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
          {editMut.error instanceof Error && !editing && (
            <div className="alert alert-error" style={{ marginTop: "var(--space-2)" }}>
              {editMut.error.message}
            </div>
          )}
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
                    placeholder="Nach Name oder E-Mail suchen…"
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
                      <th>{t("participants.colStatus")}</th>
                      <th>{t("participants.colEmail")}</th>
                      <th>{t("participants.colPosition")}</th>
                      <th>{t("participants.colRegisteredAt")}</th>
                      {questions.length > 0 && <th>Antworten</th>}
                      <th>Notiz</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredParticipants.map((p) => (
                      <tr
                        key={p.id}
                        className={
                          p.status === "cancelled" || p.status === "no_show"
                            ? "row-cancelled"
                            : undefined
                        }
                      >
                        <td className="text-bold" style={{ whiteSpace: "nowrap" }}>
                          {p.userDisplayName}
                          <button
                            type="button"
                            disabled={editMut.isPending}
                            onClick={() => setEditing(p)}
                            className="btn btn-ghost btn-sm"
                            style={{ marginLeft: 6 }}
                            title={t("participants.editRegistrationHint")}
                          >
                            {t("participants.editRegistration")}
                          </button>
                        </td>
                        <td>
                          <select
                            className="select"
                            aria-label={t("participants.colStatus")}
                            disabled={editMut.isPending}
                            value={p.status}
                            onChange={(e) =>
                              editMut.mutate({
                                participationId: p.id,
                                status: e.target.value as StaffStatus,
                              })
                            }
                            style={{
                              minWidth: 170,
                              ...(p.status === "cancelled" || p.status === "no_show"
                                ? { color: "#b42318", borderColor: "#b42318", fontWeight: 600 }
                                : {}),
                            }}
                          >
                            {STAFF_STATUSES.map((st) => (
                              <option key={st} value={st}>
                                {t(`participants.status.${st}`)}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="muted">{p.userEmail}</td>
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
  registrationDeadline: string | null;
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
    registrationDeadline,
    own,
    registerPending,
    withdrawPending,
    registerError,
    withdrawError,
    onRegister,
    onWithdraw,
  } = props;

  const deadlinePassed = registrationDeadline
    ? new Date(registrationDeadline).getTime() < Date.now()
    : false;

  const ownActive = own && (own.status === "registered" || own.status === "waitlisted");

  if (ownActive) {
    return (
      <div style={{ marginTop: "var(--space-3)" }}>
        {own.status === "registered" ? (
          <output className="registration-status">
            <span className="registration-status-icon" aria-hidden="true">
              ✓
            </span>
            <strong>{t("participants.yourStatusRegistered")}</strong>
          </output>
        ) : (
          <output className="registration-status registration-status--waitlist">
            <span className="registration-status-icon" aria-hidden="true">
              {own.waitlistPosition ?? "?"}
            </span>
            <span>
              {t("participants.yourStatusWaitlisted", { position: own.waitlistPosition ?? "?" })}
            </span>
          </output>
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

  // Vom Event-Team als teilgenommen / nicht teilgenommen markiert: keine Selbst-Anmeldung mehr
  if (own && (own.status === "attended" || own.status === "no_show")) {
    return (
      <div className="alert alert-info" style={{ marginTop: "var(--space-3)" }}>
        {t("participants.yourStatusFinal", { status: t(`participants.status.${own.status}`) })}
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

  if (deadlinePassed) {
    return (
      <div style={{ marginTop: "var(--space-3)" }}>
        <span className="badge badge-muted" style={{ marginBottom: 8, display: "inline-block" }}>
          Anmeldung geschlossen
        </span>
        <div>
          <button
            type="button"
            disabled
            className="btn btn-primary"
            title="Die Anmeldefrist für dieses Event ist abgelaufen."
          >
            {t("participants.register")}
          </button>
        </div>
        <p className="muted" style={{ marginTop: 8 }}>
          Die Anmeldefrist ist abgelaufen — eine Anmeldung ist nicht mehr möglich.
        </p>
      </div>
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
    if ((q.type === "single_choice" || q.type === "free_text") && typeof a.value === "string")
      return a.value;
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

