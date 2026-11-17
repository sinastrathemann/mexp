import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { apiFetch } from "../api/client";
import { ContentEntryForm, type ContentFormValue } from "../events/content-entry-form";
import {
  addDays,
  addMonths,
  firstOfMonth,
  fmtIsoDate,
  isoWeek,
  mondayOf,
  monthWeeks,
  parseIsoDate,
  toIsoDate,
} from "../events/planning-utils";
import {
  type AssigneeDto,
  CONTENT_CHANNELS,
  type ContentChannel,
  type ContentPlanEntryDto,
} from "../events/project-plan-types";
import type { EventDto } from "../events/types";

const WEEKDAYS = 5;
type View = "week" | "month" | "list";

/** Contentplan des EXM-Teams (Feedback-Runde 5) — ersetzt die Excel „Contentplan 2026". */
export default function ContentPlanPage() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [view, setView] = useState<View>("week");
  // Bezugsdatum für alle Ansichten; Woche/Liste starten am Montag, Monat am 1.
  const today = toIsoDate(new Date());
  const [anchor, setAnchor] = useState(today);
  const monday = mondayOf(anchor);
  const weeks = monthWeeks(anchor);
  const [channel, setChannel] = useState<ContentChannel | "">("");
  const [person, setPerson] = useState("");
  const [form, setForm] = useState<ContentFormValue | null>(null);

  // Woche: Mo–Fr; Monat: alle Wochen mit Werktagen im Monat; Liste: 8 Wochen ab Montag.
  const from = view === "month" ? (weeks[0] ?? monday) : monday;
  const to =
    view === "week"
      ? addDays(monday, 6)
      : view === "month"
        ? addDays(weeks[weeks.length - 1] ?? monday, 6)
        : addDays(monday, 7 * 8 - 1);
  const step = (dir: 1 | -1) =>
    setAnchor(view === "month" ? addMonths(anchor, dir) : addDays(monday, 7 * dir));

  const entriesQ = useQuery({
    queryKey: ["content-plan", from, to],
    queryFn: () =>
      apiFetch<{ entries: ContentPlanEntryDto[] }>(`/content-plan?from=${from}&to=${to}`),
  });
  const assigneesQ = useQuery({
    queryKey: ["task-assignees"],
    queryFn: () => apiFetch<{ assignees: AssigneeDto[] }>("/task-assignees"),
  });
  const eventsQ = useQuery({
    queryKey: ["events", "list", "active"],
    queryFn: () => apiFetch<{ events: EventDto[] }>("/events"),
  });

  const saveMut = useMutation({
    mutationFn: (v: ContentFormValue) => {
      const body = JSON.stringify({
        date: v.date,
        title: v.title.trim(),
        channel: v.channel,
        responsibleId: v.responsibleId || null,
        eventId: v.eventId || null,
        eventName: (!v.eventId && v.eventFreeText && v.eventName.trim()) || null,
        note: v.note.trim() || null,
      });
      return v.id
        ? apiFetch(`/content-plan/${v.id}`, { method: "PATCH", body })
        : apiFetch("/content-plan", { method: "POST", body });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["content-plan"] });
      setForm(null);
    },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/content-plan/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["content-plan"] });
      setForm(null);
    },
  });

  const events = eventsQ.data?.events ?? [];
  const eventTitle = (id: string | null) =>
    id ? (events.find((e) => e.id === id)?.title ?? null) : null;
  // Verknüpftes Event oder Freitext
  const eventLabel = (e: ContentPlanEntryDto) => eventTitle(e.eventId) ?? e.eventName ?? null;
  const entries = (entriesQ.data?.entries ?? [])
    .filter((e) => (channel ? e.channel === channel : true))
    .filter((e) => (person ? e.responsibleId === person : true));

  function openNew(date: string) {
    saveMut.reset();
    setForm({
      id: null,
      date,
      title: "",
      channel: "general",
      responsibleId: "",
      eventId: "",
      eventName: "",
      eventFreeText: false,
      note: "",
    });
  }
  function openEdit(e: ContentPlanEntryDto) {
    saveMut.reset();
    setForm({
      id: e.id,
      date: e.date,
      title: e.title,
      channel: e.channel,
      responsibleId: e.responsibleId ?? "",
      eventId: e.eventId ?? "",
      eventName: e.eventName ?? "",
      eventFreeText: !e.eventId && !!e.eventName,
      note: e.note ?? "",
    });
  }

  const entryCard = (e: ContentPlanEntryDto) => (
    <button
      key={e.id}
      type="button"
      className={`content-entry content-${e.channel}`}
      onClick={() => openEdit(e)}
    >
      <span className="content-entry-title">{e.title}</span>
      <span className="muted text-sm">
        {t(`planning.channel.${e.channel}`)}
        {e.responsibleName ? ` · ${e.responsibleName}` : ""}
        {eventLabel(e) ? ` · ${eventLabel(e)}` : ""}
      </span>
    </button>
  );

  return (
    <div className="page">
      <div className="eyebrow">mEXP · {t("planning.teamOnly")}</div>
      <h1>{t("planning.contentPlanTitle")}</h1>

      <div
        className="row"
        style={{ gap: "var(--space-2)", flexWrap: "wrap", alignItems: "center" }}
      >
        <button type="button" className="btn btn-outline btn-sm" onClick={() => step(-1)}>
          ‹
        </button>
        <strong>
          {view === "month"
            ? parseIsoDate(firstOfMonth(anchor)).toLocaleDateString(i18n.language, {
                month: "long",
                year: "numeric",
              })
            : `${t("planning.week", { week: isoWeek(monday) })} · ${fmtIsoDate(monday, false)}–${fmtIsoDate(addDays(monday, 4))}`}
        </strong>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => step(1)}>
          ›
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAnchor(today)}>
          {t("planning.today")}
        </button>
        <span style={{ flex: 1 }} />
        {(["week", "month", "list"] as const).map((v) => (
          <button
            key={v}
            type="button"
            className={`btn btn-sm ${view === v ? "btn-primary" : "btn-outline"}`}
            onClick={() => setView(v)}
          >
            {t(`planning.view.${v}`)}
          </button>
        ))}
        <select
          className="select"
          aria-label={t("planning.channelLabel")}
          value={channel}
          onChange={(e) => setChannel(e.target.value as ContentChannel | "")}
          style={{ width: "auto" }}
        >
          <option value="">{t("planning.allChannels")}</option>
          {CONTENT_CHANNELS.map((c) => (
            <option key={c} value={c}>
              {t(`planning.channel.${c}`)}
            </option>
          ))}
        </select>
        <select
          className="select"
          aria-label={t("planning.personLabel")}
          value={person}
          onChange={(e) => setPerson(e.target.value)}
          style={{ width: "auto" }}
        >
          <option value="">{t("planning.allPersons")}</option>
          {(assigneesQ.data?.assignees ?? []).map((a) => (
            <option key={a.id} value={a.id}>
              {a.displayName}
            </option>
          ))}
        </select>
      </div>

      {form && (
        <ContentEntryForm
          value={form}
          assignees={assigneesQ.data?.assignees ?? []}
          events={events}
          pending={saveMut.isPending || deleteMut.isPending}
          error={
            saveMut.error instanceof Error
              ? saveMut.error.message
              : deleteMut.error instanceof Error
                ? deleteMut.error.message
                : null
          }
          onChange={setForm}
          onSave={() => saveMut.mutate(form)}
          onDelete={form.id ? () => deleteMut.mutate(form.id as string) : undefined}
          onCancel={() => setForm(null)}
        />
      )}

      {entriesQ.error instanceof Error && (
        <div className="alert alert-error">{entriesQ.error.message}</div>
      )}

      {view === "week" ? (
        <div className="content-week">
          {Array.from({ length: WEEKDAYS }, (_, i) => addDays(monday, i)).map((day) => (
            <div key={day} className={`content-day${day === today ? " content-day-today" : ""}`}>
              <div className="content-day-head">
                {t(`planning.weekday.${parseIsoDate(day).getDay()}`)} {fmtIsoDate(day, false)}
              </div>
              {entries.filter((e) => e.date === day).map(entryCard)}
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => openNew(day)}>
                + {t("planning.addEntry")}
              </button>
            </div>
          ))}
        </div>
      ) : view === "month" ? (
        <div className="content-month">
          {[1, 2, 3, 4, 5].map((d) => (
            <div key={d} className="content-month-head">
              {t(`planning.weekday.${d}`)}
            </div>
          ))}
          {weeks.flatMap((w) =>
            Array.from({ length: WEEKDAYS }, (_, i) => addDays(w, i)).map((day) => (
              <div
                key={day}
                className={`content-day content-month-day${
                  day.slice(0, 7) === anchor.slice(0, 7) ? "" : " content-day-outside"
                }${day === today ? " content-day-today" : ""}`}
              >
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span className="content-day-head">{fmtIsoDate(day, false)}</span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    aria-label={t("planning.addEntry")}
                    title={t("planning.addEntry")}
                    onClick={() => openNew(day)}
                  >
                    +
                  </button>
                </div>
                {entries.filter((e) => e.date === day).map(entryCard)}
              </div>
            )),
          )}
        </div>
      ) : (
        <div className="card">
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => openNew(monday)}
            >
              + {t("planning.addEntry")}
            </button>
          </div>
          {entries.length === 0 ? (
            <p className="muted">{t("planning.noEntries")}</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>{t("planning.date")}</th>
                  <th>{t("planning.titleLabel")}</th>
                  <th>{t("planning.channelLabel")}</th>
                  <th>{t("planning.personLabel")}</th>
                  <th>{t("planning.linkedEvent")}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td>{fmtIsoDate(e.date)}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => openEdit(e)}
                      >
                        {e.title}
                      </button>
                    </td>
                    <td>{t(`planning.channel.${e.channel}`)}</td>
                    <td>{e.responsibleName ?? "–"}</td>
                    <td>
                      {e.eventId && eventTitle(e.eventId) ? (
                        <Link to={`/events/${e.eventId}`}>{eventTitle(e.eventId)}</Link>
                      ) : (
                        (eventLabel(e) ?? "–")
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
