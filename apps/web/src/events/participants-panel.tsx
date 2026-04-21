import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ApiRequestError, apiFetch } from "../api/client";
import { useAuth } from "../auth/auth-context";
import type { EventDto, ParticipantDto, ParticipationDto } from "./types";

interface ParticipantsPanelProps {
  event: EventDto;
}

export function ParticipantsPanel({ event }: ParticipantsPanelProps) {
  const { t, i18n } = useTranslation();
  const { user, hasRole } = useAuth();
  const qc = useQueryClient();
  const canManage = hasRole("admin", "manager", "event_office");
  const registrationOpen = event.status === "open";

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
    mutationFn: () =>
      apiFetch<{ participation: ParticipationDto }>(`/events/${event.id}/register`, {
        method: "POST",
      }),
    onSuccess: invalidateAll,
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
        onRegister={() => registerMut.mutate()}
        onWithdraw={() => withdrawMut.mutate()}
      />

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
              <table className="table">
                <thead>
                  <tr>
                    <th>{t("participants.colName")}</th>
                    <th>{t("participants.colEmail")}</th>
                    <th>{t("participants.colStatus")}</th>
                    <th>{t("participants.colPosition")}</th>
                    <th>{t("participants.colRegisteredAt")}</th>
                    <th>{t("participants.colActions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {participants.map((p) => (
                    <tr key={p.id}>
                      <td className="text-bold">{p.userDisplayName}</td>
                      <td className="muted">{p.userEmail}</td>
                      <td>
                        <span className="badge badge-muted">
                          {t(`participants.status.${p.status}`)}
                        </span>
                      </td>
                      <td>{p.waitlistPosition ?? "—"}</td>
                      <td className="text-sm muted">{fmtDate(p.registeredAt)}</td>
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
