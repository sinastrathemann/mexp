import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api/client";
import { useAuth } from "../auth/auth-context";

type RequestStatus = "submitted" | "in_review" | "approved" | "declined";
type View = "new" | "mine" | "inbox";

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
  createdAt: string;
}

interface RequestForm {
  category: string;
  categoryDetails: string;
  participantCount: string;
  participantList: string;
  partnersInvited: boolean | null;
  dateFixed: boolean | null;
  fixedDate: string;
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

  const requestQuery = useQuery({
    queryKey: ["event-requests", view],
    queryFn: () =>
      apiFetch<{ requests: EventRequestDto[]; canManage: boolean }>(
        view === "inbox" ? "/event-requests" : "/event-requests?mine=true",
      ),
    enabled: view !== "new",
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
    mutationFn: ({ id, status }: { id: string; status: RequestStatus }) =>
      apiFetch<{ request: EventRequestDto }>(`/event-requests/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
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
      fixedDate: form.dateFixed ? new Date(form.fixedDate).toISOString() : null,
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
  const requests = requestQuery.data?.requests ?? [];
  const newInboxCount = requests.filter((request) => request.status === "submitted").length;

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
              <span className="badge badge-warning" style={{ marginLeft: 8 }}>
                {newInboxCount}
              </span>
            )}
          </button>
        )}
      </div>

      {view === "inbox" && newInboxCount > 0 && (
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
              value={form.participantList}
              onChange={(event) => updateField("participantList", event.target.value)}
            />
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
                type="datetime-local"
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
                    value={
                      request.dateFixed && request.fixedDate
                        ? formatDate(request.fixedDate)
                        : request.proposedDates || "—"
                    }
                  />
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
                {view === "inbox" && (
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
                    <div style={{ marginTop: "var(--space-3)" }}>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => navigate(`/events/new?requestId=${request.id}`)}
                      >
                        {t("eventRequests.createFromRequest")}
                      </button>
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
