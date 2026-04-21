import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../api/client";
import { useAuth } from "../auth/auth-context";
import { BUDGET_CATEGORIES, type BudgetCategory, type BudgetItemDto, type EventDto } from "./types";

interface BudgetPanelProps {
  event: EventDto;
}

interface FormState {
  category: BudgetCategory;
  description: string;
  plannedAmountEuros: string;
  currency: string;
  taxNote: string;
  notes: string;
}

const initialForm: FormState = {
  category: "venue",
  description: "",
  plannedAmountEuros: "",
  currency: "EUR",
  taxNote: "",
  notes: "",
};

const STATUS_BADGE: Record<string, string> = {
  draft: "badge badge-muted",
  submitted: "badge badge-yellow",
  approved: "badge badge-success",
  rejected: "badge badge-orange",
};

export function BudgetPanel({ event }: BudgetPanelProps) {
  const { t, i18n } = useTranslation();
  const { hasRole } = useAuth();
  const qc = useQueryClient();
  const canView = hasRole("admin", "manager", "event_office", "budget_owner");
  const canApprove = hasRole("admin", "manager", "budget_owner");
  const [form, setForm] = useState<FormState>(initialForm);
  const [showForm, setShowForm] = useState(false);
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});

  const itemsQ = useQuery({
    queryKey: ["events", event.id, "budget"],
    queryFn: () => apiFetch<{ items: BudgetItemDto[] }>(`/events/${event.id}/budget`),
    enabled: canView,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["events", event.id, "budget"] });

  const createMut = useMutation({
    mutationFn: (body: unknown) =>
      apiFetch<{ item: BudgetItemDto }>(`/events/${event.id}/budget`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      setForm(initialForm);
      setShowForm(false);
      invalidate();
    },
  });

  const submitMut = useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ item: BudgetItemDto }>(`/budget/${id}/submit`, { method: "POST" }),
    onSuccess: invalidate,
  });

  const approveMut = useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ item: BudgetItemDto }>(`/budget/${id}/approve`, { method: "POST" }),
    onSuccess: invalidate,
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiFetch<{ item: BudgetItemDto }>(`/budget/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
    onSuccess: (_d, vars) => {
      setRejectReason((s) => ({ ...s, [vars.id]: "" }));
      invalidate();
    },
  });

  const reopenMut = useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ item: BudgetItemDto }>(`/budget/${id}/reopen`, { method: "POST" }),
    onSuccess: invalidate,
  });

  if (!canView) return null;

  const items = itemsQ.data?.items ?? [];
  const totalPlanned = items.reduce((sum, i) => sum + i.plannedAmountCents, 0);
  const totalApproved = items
    .filter((i) => i.status === "approved")
    .reduce((sum, i) => sum + i.plannedAmountCents, 0);
  const fmtMoney = (cents: number, currency: string) =>
    new Intl.NumberFormat(i18n.language === "de" ? "de-DE" : "en-US", {
      style: "currency",
      currency,
    }).format(cents / 100);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const cents = Math.round(Number(form.plannedAmountEuros.replace(",", ".")) * 100);
    if (!Number.isFinite(cents) || cents < 0) return;
    createMut.mutate({
      category: form.category,
      description: form.description,
      plannedAmountCents: cents,
      currency: form.currency || "EUR",
      taxNote: form.taxNote || null,
      notes: form.notes || null,
    });
  };

  return (
    <section className="card">
      <div className="card-header">
        <h2 className="card-title">{t("budget.title")}</h2>
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          className={showForm ? "btn btn-outline btn-sm" : "btn btn-primary btn-sm"}
        >
          {showForm ? t("common.cancel") : `+ ${t("budget.addItem")}`}
        </button>
      </div>

      <div className="stat-grid">
        <div className="stat stat-orange">
          <div className="stat-value" style={{ fontSize: "var(--text-xl)" }}>
            {fmtMoney(totalPlanned, "EUR")}
          </div>
          <div className="stat-label">{t("budget.kpiPlanned")}</div>
        </div>
        <div className="stat">
          <div className="stat-value" style={{ fontSize: "var(--text-xl)" }}>
            {fmtMoney(totalApproved, "EUR")}
          </div>
          <div className="stat-label">{t("budget.kpiApproved")}</div>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card-flat">
          <div className="field-row">
            <div className="field">
              <label className="label" htmlFor="bud-cat">
                {t("budget.fieldCategory")}
              </label>
              <select
                id="bud-cat"
                className="select"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as BudgetCategory })}
              >
                {BUDGET_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {t(`budget.category.${c}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="label" htmlFor="bud-amt">
                {t("budget.fieldAmount")} ({form.currency})
              </label>
              <input
                id="bud-amt"
                className="input"
                type="text"
                inputMode="decimal"
                value={form.plannedAmountEuros}
                onChange={(e) => setForm({ ...form, plannedAmountEuros: e.target.value })}
                required
              />
            </div>
          </div>
          <div className="field">
            <label className="label" htmlFor="bud-desc">
              {t("budget.fieldDescription")}
            </label>
            <input
              id="bud-desc"
              className="input"
              type="text"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="bud-tax">
              {t("budget.fieldTaxNote")}
            </label>
            <input
              id="bud-tax"
              className="input"
              type="text"
              value={form.taxNote}
              onChange={(e) => setForm({ ...form, taxNote: e.target.value })}
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="bud-notes">
              {t("budget.fieldNotes")}
            </label>
            <textarea
              id="bud-notes"
              className="textarea"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
            />
          </div>
          <div className="form-actions">
            <button type="submit" disabled={createMut.isPending} className="btn btn-primary">
              {t("common.save")}
            </button>
            {createMut.error instanceof Error && (
              <span className="err-msg">{createMut.error.message}</span>
            )}
          </div>
        </form>
      )}

      {itemsQ.isLoading ? (
        <p className="muted">{t("auth.loading")}</p>
      ) : items.length === 0 ? (
        <p className="muted">{t("budget.empty")}</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>{t("budget.fieldCategory")}</th>
              <th>{t("budget.fieldDescription")}</th>
              <th style={{ textAlign: "right" }}>{t("budget.fieldAmount")}</th>
              <th>{t("budget.fieldStatus")}</th>
              <th>{t("budget.fieldActions")}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td className="text-bold">{t(`budget.category.${item.category}`)}</td>
                <td>
                  {item.description}
                  {item.taxNote && (
                    <div className="muted text-xs" style={{ marginTop: 2 }}>
                      {t("budget.fieldTaxNote")}: {item.taxNote}
                    </div>
                  )}
                  {item.status === "rejected" && item.rejectedReason && (
                    <div className="err-msg">
                      {t("budget.rejectedReason")}: {item.rejectedReason}
                    </div>
                  )}
                </td>
                <td style={{ textAlign: "right" }} className="text-bold">
                  {fmtMoney(item.plannedAmountCents, item.currency)}
                </td>
                <td>
                  <span className={STATUS_BADGE[item.status] ?? "badge badge-muted"}>
                    {t(`budget.status.${item.status}`)}
                  </span>
                </td>
                <td>
                  <div className="row" style={{ gap: "var(--space-2)" }}>
                    {item.status === "draft" && (
                      <button
                        type="button"
                        onClick={() => submitMut.mutate(item.id)}
                        disabled={submitMut.isPending}
                        className="btn btn-outline-orange btn-sm"
                      >
                        {t("budget.submit")}
                      </button>
                    )}
                    {item.status === "submitted" && canApprove && (
                      <>
                        <button
                          type="button"
                          onClick={() => approveMut.mutate(item.id)}
                          disabled={approveMut.isPending}
                          className="btn btn-primary btn-sm"
                        >
                          {t("budget.approve")}
                        </button>
                        <input
                          className="input"
                          type="text"
                          placeholder={t("budget.rejectReasonPlaceholder")}
                          value={rejectReason[item.id] ?? ""}
                          onChange={(e) =>
                            setRejectReason((s) => ({ ...s, [item.id]: e.target.value }))
                          }
                          style={{ width: 160 }}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            rejectMut.mutate({
                              id: item.id,
                              reason: rejectReason[item.id] ?? "",
                            })
                          }
                          disabled={rejectMut.isPending || !(rejectReason[item.id] ?? "").trim()}
                          className="btn btn-outline btn-sm"
                        >
                          {t("budget.reject")}
                        </button>
                      </>
                    )}
                    {item.status === "rejected" && (
                      <button
                        type="button"
                        onClick={() => reopenMut.mutate(item.id)}
                        disabled={reopenMut.isPending}
                        className="btn btn-ghost btn-sm"
                      >
                        {t("budget.reopen")}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
