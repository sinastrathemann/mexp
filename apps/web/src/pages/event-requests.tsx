import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api/client";
import { useAuth } from "../auth/auth-context";

type RequestStatus = "submitted" | "in_review" | "approved" | "declined";
type View = "new" | "mine" | "inbox" | "assigned";
type TimeOfDay = "day" | "evening";

interface EventRequestDto {
  id: string;
  requesterName: string | null;
  requesterEmail: string | null;
  category: string;
  categoryDetails: string;
  participantCount: number;
  participantList: string;
  partnersInvited: boolean;
  dateFixed: boolean;
  fixedDate: string | null;
  hasCalendarBlocker: boolean;
  proposedDates: string;
  wholeWeekend: boolean;
  occasion: string;
  contactIsRequester: boolean;
  contactName: string | null;
  destination: string;
  activity: string;
  suggestionsWanted: boolean;
  coworking: boolean;
  notes: string;
  status: RequestStatus;
  timeOfDay?: TimeOfDay | null;
  assignedToId?: string | null;
  assignedToName?: string | null;
  eventId?: string | null;
  createdAt: string;
}

interface AssigneeDto {
  id: string;
  displayName: string;
}

// Teilnehmerliste automatisch durchnummerieren ("1. Anna", "2. Tim", …).
// Bereits vorhandene Nummern werden entfernt und neu vergeben.
function renumberLines(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/^\s*\d+[.)]\s*/, "").trim())
    .filter((line) => line !== "")
    .map((line, index) => `${index + 1}. ${line}`)
    .join("\n");
}

interface RequestForm {
  category: string;
  categoryDetails: string;
  participantCount: string;
  participantList: string;
  partnersInvited: boolean | null;
  dateFixed: boolean | null;
  fixedDate: string;
  timeOfDay: TimeOfDay | null;
  hasCalendarBlocker: boolean | null;
  proposedDates: string;
  wholeWeekend: boolean | null;
  occasion: string;
  contactIsRequester: boolean | null;
  contactName: string;
  destination: string;
  activity: string;
  suggestionsWanted: boolean;
  coworking: boolean | null;
  notes: string;
}

const EMPTY_FORM: RequestForm = {
  category: "",
  categoryDetails: "",
  participantCount: "",
  participantList: "",
  partnersInvited: null,
  dateFixed: null,
  fixedDate: "",
  timeOfDay: null,
  hasCalendarBlocker: null,
  proposedDates: "",
  wholeWeekend: null,
  occasion: "",
  contactIsRequester: null,
  contactName: "",
  destination: "",
  activity: "",
  suggestionsWanted: false,
  coworking: null,
  notes: "",
};

const STATUSES: RequestStatus[] = ["submitted", "in_review", "approved", "declined"];

function YesNoField({
  name,
  label,
  value,
  onChange,
}: {
  name: string;
  label: string;
  value: boolean | null;
  onChange: (value: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
      <legend className="label">{label}</legend>
      <div className="row" style={{ gap: 16 }}>
        {[
          [true, t("eventRequests.yes")],
          [false, t("eventRequests.no")],
        ].map(([choice, text]) => (
          <label key={String(choice)} className="row" style={{ gap: 6 }}>
            <input
              type="radio"
              name={name}
              required
              checked={value === choice}
              onChange={() => onChange(choice as boolean)}
            />
            {text}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="event-card-meta-row">
      <span className="event-card-meta-label">{label}</span>
      <span className="event-card-meta-value" style={{ whiteSpace: "pre-wrap" }}>
        {value}
      </span>
    </div>
  );
}

export default function EventRequestsPage() {
  const { t, i18n } = useTranslation();
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const canManage = hasRole("admin", "manager", "event_office", "werkstudent");
  const [view, setView] = useState<View>("new");
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const { user } = useAuth();
  const canAssign = hasRole("admin", "manager", "event_office");
  const requestQuery = useQuery({
    queryKey: ["event-requests", view === "assigned" ? "inbox" : view],
    queryFn: () =>
      apiFetch<{ requests: EventRequestDto[]; canManage: boolean }>(
        view === "inbox" || view === "assigned" ? "/event-requests" : "/event-requests?mine=true",
      ),
    enabled: view !== "new",
  });
  const pendingQuery = useQuery({
    queryKey: ["event-requests", "pending-count"],
    queryFn: () =>
      apiFetch<{ submitted: number; assignedToMe: number }>("/event-requests/pending-count"),
    enabled: canManage,
  });
  const assigneesQuery = useQuery({
    queryKey: ["event-requests", "assignees"],
    queryFn: () => apiFetch<{ assignees: AssigneeDto[] }>("/event-requests/assignees"),
    enabled: canAssign && (view === "inbox" || view === "assigned"),
    staleTime: 5 * 60_000,
  });

  const submitMutation = useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      apiFetch<{ request: EventRequestDto }>("/event-requests", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      setForm(EMPTY_FORM);
      setFormError(null);
      setSent(true);
      setView("mine");
      queryClient.invalidateQueries({ queryKey: ["event-requests"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      ...patch
    }: { id: string; status?: RequestStatus; assignedToId?: string | null }) =>
      apiFetch<{ request: EventRequestDto }>(`/event-requests/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["event-requests"] }),
  });

  function updateField<K extends keyof RequestForm>(key: K, value: RequestForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const choices = [
      form.partnersInvited,
      form.dateFixed,
      form.hasCalendarBlocker,
      form.wholeWeekend,
      form.contactIsRequester,
      form.coworking,
    ];
    if (choices.some((choice) => choice === null)) {
      setFormError(t("eventRequests.answerAllChoices"));
      return;
    }
    if (!form.timeOfDay) {
      setFormError(t("eventRequests.timeOfDayRequired"));
      return;
    }
    if (form.dateFixed && !form.fixedDate) {
      setFormError(t("eventRequests.fixedDateRequired"));
      return;
    }
    if (!form.dateFixed && !form.proposedDates.trim()) {
      setFormError(t("eventRequests.proposedDatesRequired"));
      return;
    }
    if (!form.contactIsRequester && !form.contactName.trim()) {
      setFormError(t("eventRequests.contactRequired"));
      return;
    }

    submitMutation.mutate({
      ...form,
      participantCount: Number.parseInt(form.participantCount, 10),
      participantList: renumberLines(form.participantList),
      // Nur das Datum (UTC-Mitternacht); die Uhrzeit klärt das Event-Team später
      fixedDate: form.dateFixed ? `${form.fixedDate}T00:00:00.000Z` : null,
      contactName: form.contactIsRequester ? null : form.contactName.trim(),
    });
  }

  const formatDate = (value: string) =>
    new Date(value).toLocaleString(i18n.language === "de" ? "de-DE" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  const yesNo = (value: boolean | null) =>
    value === null ? "—" : value ? t("eventRequests.yes") : t("eventRequests.no");
  const formatDay = (value: string) =>
    new Date(value).toLocaleDateString(i18n.language === "de" ? "de-DE" : "en-US", {
      dateStyle: "medium",
      timeZone: "UTC",
    });
  const allRequests = requestQuery.data?.requests ?? [];
  const requests =
    view === "assigned" ? allRequests.filter((r) => r.assignedToId === user?.id) : allRequests;
  const newInboxCount = pendingQuery.data?.submitted ?? 0;
  const assignedCount = pendingQuery.data?.assignedToMe ?? 0;

  return (
    <div className="page page-narrow">
      <div className="page-header">
        <div>
          <div className="eyebrow">{t("eventRequests.eyebrow")}</div>
          <h1 className="page-title">{t("eventRequests.title")}</h1>
          <p className="page-subtitle">{t("eventRequests.subtitle")}</p>
        </div>
      </div>

      <div
        className="row"
        role="tablist"
        aria-label={t("eventRequests.views")}
        style={{ gap: 8, marginBottom: 20 }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={view === "new"}
          className={view === "new" ? "btn btn-primary btn-sm" : "btn btn-outline btn-sm"}
          onClick={() => setView("new")}
        >
          {t("eventRequests.newRequest")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "mine"}
          className={view === "mine" ? "btn btn-primary btn-sm" : "btn btn-outline btn-sm"}
          onClick={() => setView("mine")}
        >
          {t("eventRequests.myRequests")}
        </button>
        {canManage && (
          <button
            type="button"
            role="tab"
            aria-selected={view === "inbox"}
            className={view === "inbox" ? "btn btn-primary btn-sm" : "btn btn-outline btn-sm"}
            onClick={() => setView("inbox")}
          >
            {t("eventRequests.inbox")}
            {newInboxCount > 0 && (
              <span className="badge badge-orange" style={{ marginLeft: 8 }}>
                {newInboxCount}
              </span>
            )}
          </button>
        )}
        {canManage && (
          <button
            type="button"
            role="tab"
            aria-selected={view === "assigned"}
            className={view === "assigned" ? "btn btn-primary btn-sm" : "btn btn-outline btn-sm"}
            onClick={() => setView("assigned")}
          >
            {t("eventRequests.assignedToMe")}
            {assignedCount > 0 && (
              <span className="badge badge-orange" style={{ marginLeft: 8 }}>
                {assignedCount}
              </span>
            )}
          </button>
        )}
      </div>

      {(view === "inbox" || view === "assigned") && newInboxCount > 0 && (
        <div className="alert alert-success" style={{ marginBottom: 16 }}>
          {t("eventRequests.newRequestPing", { count: newInboxCount })}
        </div>
      )}

      {view === "new" && (
        <form onSubmit={submitRequest} className="card">
          <div className="field-row">
            <div className="field">
              <label className="label" htmlFor="request-category">
                {t("eventRequests.category")}
              </label>
              <select
                id="request-category"
                className="select"
                required
                value={form.category}
                onChange={(event) => updateField("category", event.target.value)}
              >
                <option value="">{t("eventRequests.chooseCategory")}</option>
                {(["team", "division", "coworking", "other"] as const).map((category) => (
                  <option key={category} value={category}>
                    {t(`eventRequests.categories.${category}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="label" htmlFor="request-category-details">
                {t("eventRequests.categoryDetails")}
              </label>
              <input
                id="request-category-details"
                className="input"
                maxLength={2000}
                value={form.categoryDetails}
                onChange={(event) => updateField("categoryDetails", event.target.value)}
              />
            </div>
          </div>

          <h2 className="card-title">{t("eventRequests.participants")}</h2>
          <div className="field-row">
            <div className="field">
              <label className="label" htmlFor="request-count">
                {t("eventRequests.participantCount")}
              </label>
              <input
                id="request-count"
                className="input"
                type="number"
                min={1}
                max={500}
                required
                value={form.participantCount}
                onChange={(event) => updateField("participantCount", event.target.value)}
              />
            </div>
            <YesNoField
              name="request-partners"
              label={t("eventRequests.partnersInvited")}
              value={form.partnersInvited}
              onChange={(value) => updateField("partnersInvited", value)}
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="request-participants">
              {t("eventRequests.participantList")}
            </label>
            <textarea
              id="request-participants"
              className="textarea"
              rows={3}
              maxLength={5000}
              placeholder={t("eventRequests.participantListPlaceholder")}
              value={form.participantList}
              onChange={(event) => updateField("participantList", event.target.value)}
              onFocus={() => {
                if (form.participantList === "") updateField("participantList", "1. ");
              }}
              onKeyDown={(event) => {
                // Bei Enter direkt die nächste Nummer vorgeben
                if (event.key !== "Enter") return;
                event.preventDefault();
                const el = event.currentTarget;
                const before = form.participantList.slice(0, el.selectionStart);
                const after = form.participantList.slice(el.selectionEnd);
                const insert = `\n${before.split("\n").length + 1}. `;
                updateField("participantList", before + insert + after);
                const caret = before.length + insert.length;
                requestAnimationFrame(() => el.setSelectionRange(caret, caret));
              }}
              onBlur={() => updateField("participantList", renumberLines(form.participantList))}
            />
            <p className="help-text">{t("eventRequests.participantListHint")}</p>
          </div>

          <h2 className="card-title">{t("eventRequests.dateSection")}</h2>
          <YesNoField
            name="request-date-fixed"
            label={t("eventRequests.dateFixed")}
            value={form.dateFixed}
            onChange={(value) => updateField("dateFixed", value)}
          />
          {form.dateFixed ? (
            <div className="field">
              <label className="label" htmlFor="request-fixed-date">
                {t("eventRequests.fixedDate")}
              </label>
              <input
                id="request-fixed-date"
                className="input"
                type="date"
                required
                value={form.fixedDate}
                onChange={(event) => updateField("fixedDate", event.target.value)}
              />
            </div>
          ) : form.dateFixed === false ? (
            <div className="field">
              <label className="label" htmlFor="request-proposed-dates">
                {t("eventRequests.proposedDates")}
              </label>
              <textarea
                id="request-proposed-dates"
                className="textarea"
                rows={3}
                required
                maxLength={2000}
                value={form.proposedDates}
                onChange={(event) => updateField("proposedDates", event.target.value)}
              />
            </div>
          ) : null}
          <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="label">{t("eventRequests.timeOfDay")}</legend>
            <div className="row" style={{ gap: 16 }}>
              {(["day", "evening"] as const).map((choice) => (
                <label key={choice} className="row" style={{ gap: 6 }}>
                  <input
                    type="radio"
                    name="request-time-of-day"
                    required
                    checked={form.timeOfDay === choice}
                    onChange={() => updateField("timeOfDay", choice)}
                  />
                  {t(`eventRequests.timeOfDayOptions.${choice}`)}
                </label>
              ))}
            </div>
            <p className="help-text">{t("eventRequests.timeOfDayHint")}</p>
          </fieldset>
          <div className="field-row">
            <YesNoField
              name="request-calendar-blocker"
              label={t("eventRequests.calendarBlocker")}
              value={form.hasCalendarBlocker}
              onChange={(value) => updateField("hasCalendarBlocker", value)}
            />
            <YesNoField
              name="request-weekend"
              label={t("eventRequests.wholeWeekend")}
              value={form.wholeWeekend}
              onChange={(value) => updateField("wholeWeekend", value)}
            />
          </div>

          <h2 className="card-title">{t("eventRequests.eventSection")}</h2>
          <div className="field">
            <label className="label" htmlFor="request-occasion">
              {t("eventRequests.occasion")}
            </label>
            <input
              id="request-occasion"
              className="input"
              required
              maxLength={2000}
              value={form.occasion}
              onChange={(event) => updateField("occasion", event.target.value)}
            />
          </div>
          <div className="field-row">
            <YesNoField
              name="request-contact"
              label={t("eventRequests.contactIsRequester")}
              value={form.contactIsRequester}
              onChange={(value) => updateField("contactIsRequester", value)}
            />
            {form.contactIsRequester === false && (
              <div className="field">
                <label className="label" htmlFor="request-contact-name">
                  {t("eventRequests.contactName")}
                </label>
                <input
                  id="request-contact-name"
                  className="input"
                  required
                  maxLength={200}
                  value={form.contactName}
                  onChange={(event) => updateField("contactName", event.target.value)}
                />
              </div>
            )}
          </div>
          <div className="field-row">
            <div className="field">
              <label className="label" htmlFor="request-destination">
                {t("eventRequests.destination")}
              </label>
              <input
                id="request-destination"
                className="input"
                maxLength={500}
                value={form.destination}
                onChange={(event) => updateField("destination", event.target.value)}
              />
            </div>
            <div className="field">
              <label className="label" htmlFor="request-activity">
                {t("eventRequests.activity")}
              </label>
              <input
                id="request-activity"
                className="input"
                maxLength={2000}
                value={form.activity}
                onChange={(event) => updateField("activity", event.target.value)}
              />
            </div>
          </div>
          <label className="row" style={{ gap: 8, margin: "var(--space-3) 0" }}>
            <input
              type="checkbox"
              checked={form.suggestionsWanted}
              onChange={(event) => updateField("suggestionsWanted", event.target.checked)}
            />
            {t("eventRequests.suggestionsWanted")}
          </label>
          <YesNoField
            name="request-coworking"
            label={t("eventRequests.coworking")}
            value={form.coworking}
            onChange={(value) => updateField("coworking", value)}
          />
          <div className="field">
            <label className="label" htmlFor="request-notes">
              {t("eventRequests.notes")}
            </label>
            <textarea
              id="request-notes"
              className="textarea"
              rows={4}
              maxLength={5000}
              value={form.notes}
              onChange={(event) => updateField("notes", event.target.value)}
            />
          </div>
          {(formError || submitMutation.error instanceof Error) && (
            <div className="alert alert-error">
              {formError ?? (submitMutation.error as Error).message}
            </div>
          )}
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={submitMutation.isPending}>
              {submitMutation.isPending ? t("eventRequests.submitting") : t("eventRequests.submit")}
            </button>
          </div>
        </form>
      )}

      {view !== "new" && (
        <section>
          {sent && view === "mine" && (
            <div className="alert alert-success">{t("eventRequests.submitted")}</div>
          )}
          {requestQuery.isLoading && <div className="card">{t("auth.loading")}</div>}
          {requestQuery.error instanceof Error && (
            <div className="alert alert-error">{requestQuery.error.message}</div>
          )}
          {!requestQuery.isLoading && requests.length === 0 && (
            <div className="card" style={{ color: "var(--fg-muted)" }}>
              {view === "inbox" ? t("eventRequests.emptyInbox") : t("eventRequests.emptyMine")}
            </div>
          )}
          <div className="event-grid">
            {requests.map((request) => (
              <article className="event-card" key={request.id}>
                <div className="event-card-head">
                  <span className="event-card-type">
                    {t(`eventRequests.categories.${request.category}`, {
                      defaultValue: request.category,
                    })}
                  </span>
                  <span className="badge badge-muted">
                    {t(`eventRequests.status.${request.status}`)}
                  </span>
                </div>
                <h2 className="event-card-title">{request.occasion}</h2>
                <div className="event-card-meta">
                  {view === "inbox" && (
                    <MetaRow
                      label={t("eventRequests.requester")}
                      value={request.requesterName ?? request.requesterEmail ?? "—"}
                    />
                  )}
                  <MetaRow
                    label={t("eventRequests.participants")}
                    value={String(request.participantCount)}
                  />
                  <MetaRow
                    label={t("eventRequests.dateSection")}
                    value={[
                      request.dateFixed && request.fixedDate
                        ? formatDay(request.fixedDate)
                        : request.proposedDates || "—",
                      request.timeOfDay
                        ? t(`eventRequests.timeOfDayOptions.${request.timeOfDay}`)
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  />
                  {(view === "inbox" || view === "assigned") && (
                    <MetaRow
                      label={t("eventRequests.assignedTo")}
                      value={request.assignedToName ?? "—"}
                    />
                  )}
                  <MetaRow
                    label={t("eventRequests.destination")}
                    value={request.destination || "—"}
                  />
                  <MetaRow
                    label={t("eventRequests.submittedAt")}
                    value={formatDate(request.createdAt)}
                  />
                </div>
                <details style={{ marginTop: "var(--space-3)" }}>
                  <summary>{t("eventRequests.showDetails")}</summary>
                  <div className="event-card-meta" style={{ marginTop: "var(--space-3)" }}>
                    <MetaRow
                      label={t("eventRequests.categoryDetails")}
                      value={request.categoryDetails || "—"}
                    />
                    <MetaRow
                      label={t("eventRequests.participantList")}
                      value={request.participantList || "—"}
                    />
                    <MetaRow
                      label={t("eventRequests.partnersInvited")}
                      value={yesNo(request.partnersInvited)}
                    />
                    <MetaRow
                      label={t("eventRequests.calendarBlocker")}
                      value={yesNo(request.hasCalendarBlocker)}
                    />
                    <MetaRow
                      label={t("eventRequests.wholeWeekend")}
                      value={yesNo(request.wholeWeekend)}
                    />
                    <MetaRow
                      label={t("eventRequests.contactName")}
                      value={
                        request.contactIsRequester
                          ? (request.requesterName ?? "—")
                          : (request.contactName ?? "—")
                      }
                    />
                    <MetaRow label={t("eventRequests.activity")} value={request.activity || "—"} />
                    <MetaRow
                      label={t("eventRequests.suggestionsWanted")}
                      value={yesNo(request.suggestionsWanted)}
                    />
                    <MetaRow
                      label={t("eventRequests.coworking")}
                      value={yesNo(request.coworking)}
                    />
                    <MetaRow label={t("eventRequests.notes")} value={request.notes || "—"} />
                  </div>
                </details>
                {(view === "inbox" || view === "assigned") && (
                  <>
                    <div className="field" style={{ marginTop: "var(--space-3)" }}>
                      <label className="label" htmlFor={`request-status-${request.id}`}>
                        {t("eventRequests.updateStatus")}
                      </label>
                      <select
                        id={`request-status-${request.id}`}
                        className="select"
                        disabled={updateMutation.isPending}
                        value={request.status}
                        onChange={(event) =>
                          updateMutation.mutate({
                            id: request.id,
                            status: event.target.value as RequestStatus,
                          })
                        }
                      >
                        {STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {t(`eventRequests.status.${status}`)}
                          </option>
                        ))}
                      </select>
                    </div>
                    {canAssign && (
                      <div className="field" style={{ marginTop: "var(--space-3)" }}>
                        <label className="label" htmlFor={`request-assignee-${request.id}`}>
                          {t("eventRequests.forwardTo")}
                        </label>
                        <select
                          id={`request-assignee-${request.id}`}
                          className="select"
                          disabled={updateMutation.isPending}
                          value={request.assignedToId ?? ""}
                          onChange={(event) =>
                            updateMutation.mutate({
                              id: request.id,
                              assignedToId: event.target.value || null,
                            })
                          }
                        >
                          <option value="">{t("eventRequests.notAssigned")}</option>
                          {(assigneesQuery.data?.assignees ?? []).map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.displayName}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div style={{ marginTop: "var(--space-3)" }}>
                      {request.eventId ? (
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => navigate(`/events/${request.eventId}`)}
                        >
                          {t("eventRequests.openEvent")}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => navigate(`/events/new?requestId=${request.id}`)}
                        >
                          {t("eventRequests.createFromRequest")}
                        </button>
                      )}
                    </div>
                  </>
                )}
              </article>
            ))}
          </div>
          {updateMutation.error instanceof Error && (
            <div className="alert alert-error" style={{ marginTop: "var(--space-3)" }}>
              {updateMutation.error.message}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
