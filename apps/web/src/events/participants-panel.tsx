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
    <section
      style={{
        marginTop: "2rem",
        border: "1px solid #ddd",
        borderRadius: 8,
        padding: "1.5rem",
      }}
    >
      <h2 style={{ fontSize: "1.1rem", marginTop: 0 }}>{t("participants.sectionTitle")}</h2>

      {canManage && (
        <p style={{ color: "#555", marginTop: 0 }}>
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
          <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <a
              href={`/api/events/${event.id}/participants.csv`}
              target="_blank"
              rel="noreferrer"
              style={{
                padding: "0.5rem 1rem",
                border: "1px solid #ccc",
                borderRadius: 4,
                textDecoration: "none",
                color: "#333",
              }}
            >
              {t("participants.exportCsv")}
            </a>
            <a
              href={`/api/events/${event.id}/emergency-list`}
              target="_blank"
              rel="noreferrer"
              style={{
                padding: "0.5rem 1rem",
                border: "1px solid #ccc",
                borderRadius: 4,
                textDecoration: "none",
                color: "#333",
              }}
            >
              {t("participants.emergencyList")}
            </a>
          </div>
          {waitlistCount > 0 && event.capacity !== null && activeCount < event.capacity && (
            <div style={{ marginTop: "1rem" }}>
              <button
                type="button"
                disabled={promoteMut.isPending}
                onClick={() => promoteMut.mutate()}
                style={{ padding: "0.5rem 1rem" }}
              >
                {promoteMut.isPending
                  ? t("participants.promoting")
                  : t("participants.promoteWaitlist")}
              </button>
              {promoteMut.error instanceof Error && (
                <p style={{ color: "#b00020" }}>{promoteMut.error.message}</p>
              )}
            </div>
          )}

          <div style={{ marginTop: "1rem", overflowX: "auto" }}>
            {participants.length === 0 ? (
              <p style={{ color: "#777" }}>{t("participants.empty")}</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #ddd", textAlign: "left" }}>
                    <th style={{ padding: "0.5rem" }}>{t("participants.colName")}</th>
                    <th style={{ padding: "0.5rem" }}>{t("participants.colEmail")}</th>
                    <th style={{ padding: "0.5rem" }}>{t("participants.colStatus")}</th>
                    <th style={{ padding: "0.5rem" }}>{t("participants.colPosition")}</th>
                    <th style={{ padding: "0.5rem" }}>{t("participants.colRegisteredAt")}</th>
                    <th style={{ padding: "0.5rem" }}>{t("participants.colActions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {participants.map((p) => (
                    <tr key={p.id} style={{ borderBottom: "1px solid #eee" }}>
                      <td style={{ padding: "0.5rem" }}>{p.userDisplayName}</td>
                      <td style={{ padding: "0.5rem" }}>{p.userEmail}</td>
                      <td style={{ padding: "0.5rem" }}>{t(`participants.status.${p.status}`)}</td>
                      <td style={{ padding: "0.5rem" }}>{p.waitlistPosition ?? "—"}</td>
                      <td style={{ padding: "0.5rem" }}>{fmtDate(p.registeredAt)}</td>
                      <td style={{ padding: "0.5rem", display: "flex", gap: "0.25rem" }}>
                        {p.status === "registered" && checkInPhase && (
                          <button
                            type="button"
                            disabled={checkInMut.isPending}
                            onClick={() => checkInMut.mutate(p.id)}
                            style={{ padding: "0.25rem 0.5rem", fontSize: "0.85rem" }}
                          >
                            {t("participants.checkIn")}
                          </button>
                        )}
                        {p.status === "registered" && noShowPhase && (
                          <button
                            type="button"
                            disabled={noShowMut.isPending}
                            onClick={() => noShowMut.mutate(p.id)}
                            style={{ padding: "0.25rem 0.5rem", fontSize: "0.85rem" }}
                          >
                            {t("participants.markNoShow")}
                          </button>
                        )}
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
      <div style={{ marginTop: "0.5rem" }}>
        {own.status === "registered" ? (
          <p>{t("participants.yourStatusRegistered")}</p>
        ) : (
          <p>{t("participants.yourStatusWaitlisted", { position: own.waitlistPosition ?? "?" })}</p>
        )}
        <button
          type="button"
          disabled={withdrawPending}
          onClick={onWithdraw}
          style={{ padding: "0.5rem 1rem" }}
        >
          {withdrawPending ? t("participants.withdrawing") : t("participants.withdraw")}
        </button>
        {withdrawError instanceof ApiRequestError && (
          <p style={{ color: "#b00020" }}>{withdrawError.message}</p>
        )}
      </div>
    );
  }

  if (!registrationOpen) {
    return (
      <p style={{ color: "#777", marginTop: "0.5rem" }}>
        {t("participants.registrationClosed", { status: t(`events.status.${eventStatus}`) })}
      </p>
    );
  }

  return (
    <div style={{ marginTop: "0.5rem" }}>
      <button
        type="button"
        disabled={registerPending}
        onClick={onRegister}
        style={{ padding: "0.5rem 1rem" }}
      >
        {registerPending ? t("participants.registering") : t("participants.register")}
      </button>
      {registerError instanceof ApiRequestError && (
        <p style={{ color: "#b00020" }}>{registerError.message}</p>
      )}
    </div>
  );
}
