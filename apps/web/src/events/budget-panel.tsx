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
    <section style={{ marginTop: "2rem" }}>
      <h2 style={{ fontSize: "1.1rem" }}>{t("budget.title")}</h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: "1rem",
          marginBottom: "1rem",
        }}
      >
        <KpiCard label={t("budget.kpiPlanned")} value={fmtMoney(totalPlanned, "EUR")} />
        <KpiCard label={t("budget.kpiApproved")} value={fmtMoney(totalApproved, "EUR")} />
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <button type="button" onClick={() => setShowForm((s) => !s)}>
          {showForm ? t("common.cancel") : t("budget.addItem")}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0.5rem",
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: "1rem",
            marginBottom: "1rem",
          }}
        >
          <label>
            {t("budget.fieldCategory")}
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value as BudgetCategory })}
              style={{ width: "100%" }}
            >
              {BUDGET_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`budget.category.${c}`)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("budget.fieldAmount")} ({form.currency})
            <input
              type="text"
              inputMode="decimal"
              value={form.plannedAmountEuros}
              onChange={(e) => setForm({ ...form, plannedAmountEuros: e.target.value })}
              required
              style={{ width: "100%" }}
            />
          </label>
          <label style={{ gridColumn: "1 / -1" }}>
            {t("budget.fieldDescription")}
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              required
              style={{ width: "100%" }}
            />
          </label>
          <label style={{ gridColumn: "1 / -1" }}>
            {t("budget.fieldTaxNote")}
            <input
              type="text"
              value={form.taxNote}
              onChange={(e) => setForm({ ...form, taxNote: e.target.value })}
              style={{ width: "100%" }}
            />
          </label>
          <label style={{ gridColumn: "1 / -1" }}>
            {t("budget.fieldNotes")}
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              style={{ width: "100%" }}
            />
          </label>
          <div style={{ gridColumn: "1 / -1" }}>
            <button type="submit" disabled={createMut.isPending}>
              {t("common.save")}
            </button>
            {createMut.error instanceof Error && (
              <span style={{ color: "#b00020", marginLeft: "1rem" }}>
                {createMut.error.message}
              </span>
            )}
          </div>
        </form>
      )}

      {itemsQ.isLoading ? (
        <p>{t("auth.loading")}</p>
      ) : items.length === 0 ? (
        <p style={{ color: "#888" }}>{t("budget.empty")}</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
              <th style={{ padding: "0.5rem" }}>{t("budget.fieldCategory")}</th>
              <th style={{ padding: "0.5rem" }}>{t("budget.fieldDescription")}</th>
              <th style={{ padding: "0.5rem", textAlign: "right" }}>{t("budget.fieldAmount")}</th>
              <th style={{ padding: "0.5rem" }}>{t("budget.fieldStatus")}</th>
              <th style={{ padding: "0.5rem" }}>{t("budget.fieldActions")}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "0.5rem" }}>{t(`budget.category.${item.category}`)}</td>
                <td style={{ padding: "0.5rem" }}>
                  {item.description}
                  {item.taxNote && (
                    <div style={{ color: "#888", fontSize: "0.85rem" }}>
                      {t("budget.fieldTaxNote")}: {item.taxNote}
                    </div>
                  )}
                  {item.status === "rejected" && item.rejectedReason && (
                    <div style={{ color: "#b00020", fontSize: "0.85rem" }}>
                      {t("budget.rejectedReason")}: {item.rejectedReason}
                    </div>
                  )}
                </td>
                <td style={{ padding: "0.5rem", textAlign: "right" }}>
                  {fmtMoney(item.plannedAmountCents, item.currency)}
                </td>
                <td style={{ padding: "0.5rem" }}>{t(`budget.status.${item.status}`)}</td>
                <td style={{ padding: "0.5rem" }}>
                  {item.status === "draft" && (
                    <button
                      type="button"
                      onClick={() => submitMut.mutate(item.id)}
                      disabled={submitMut.isPending}
                    >
                      {t("budget.submit")}
                    </button>
                  )}
                  {item.status === "submitted" && canApprove && (
                    <span style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => approveMut.mutate(item.id)}
                        disabled={approveMut.isPending}
                      >
                        {t("budget.approve")}
                      </button>
                      <input
                        type="text"
                        placeholder={t("budget.rejectReasonPlaceholder")}
                        value={rejectReason[item.id] ?? ""}
                        onChange={(e) =>
                          setRejectReason((s) => ({ ...s, [item.id]: e.target.value }))
                        }
                        style={{ width: 140 }}
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
                      >
                        {t("budget.reject")}
                      </button>
                    </span>
                  )}
                  {item.status === "rejected" && (
                    <button
                      type="button"
                      onClick={() => reopenMut.mutate(item.id)}
                      disabled={reopenMut.isPending}
                    >
                      {t("budget.reopen")}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: "0.75rem 1rem" }}>
      <div style={{ color: "#666", fontSize: "0.85rem" }}>{label}</div>
      <div style={{ fontSize: "1.3rem", fontWeight: 600 }}>{value}</div>
    </div>
  );
}
