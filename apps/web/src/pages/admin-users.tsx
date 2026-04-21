import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../api/client";
import { ROLE_NAMES } from "../auth/types";
import type { AdminUserRow, RoleName } from "../auth/types";

export default function AdminUsersPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => apiFetch<{ users: AdminUserRow[] }>("/admin/users"),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "users"] });

  const createMut = useMutation({
    mutationFn: (input: {
      email: string;
      password: string;
      displayName: string;
      roles: RoleName[];
    }) =>
      apiFetch("/admin/users", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: invalidate,
  });

  const toggleActiveMut = useMutation({
    mutationFn: (input: { id: string; isActive: boolean }) =>
      apiFetch(`/admin/users/${input.id}/active`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: input.isActive }),
      }),
    onSuccess: invalidate,
  });

  const addRoleMut = useMutation({
    mutationFn: (input: { id: string; role: RoleName }) =>
      apiFetch(`/admin/users/${input.id}/roles`, {
        method: "POST",
        body: JSON.stringify({ role: input.role }),
      }),
    onSuccess: invalidate,
  });

  const removeRoleMut = useMutation({
    mutationFn: (input: { id: string; role: RoleName }) =>
      apiFetch(`/admin/users/${input.id}/roles/${input.role}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const resetPwMut = useMutation({
    mutationFn: (input: { id: string; newPassword: string }) =>
      apiFetch(`/admin/users/${input.id}/password`, {
        method: "POST",
        body: JSON.stringify({ newPassword: input.newPassword }),
      }),
  });

  return (
    <div style={{ padding: "2rem", fontFamily: "system-ui", maxWidth: 1000 }}>
      <h1>{t("admin.usersTitle")}</h1>

      <CreateUserForm
        onSubmit={(v) => createMut.mutateAsync(v).catch(() => undefined)}
        pending={createMut.isPending}
        error={createMut.error}
      />

      <h2 style={{ marginTop: "2rem" }}>{t("admin.usersListTitle")}</h2>
      {isLoading && <p>{t("auth.loading")}</p>}
      {data && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "2px solid #333" }}>
              <th style={{ padding: "0.5rem" }}>{t("admin.colEmail")}</th>
              <th style={{ padding: "0.5rem" }}>{t("admin.colDisplayName")}</th>
              <th style={{ padding: "0.5rem" }}>{t("admin.colRoles")}</th>
              <th style={{ padding: "0.5rem" }}>{t("admin.colStatus")}</th>
              <th style={{ padding: "0.5rem" }}>{t("admin.colActions")}</th>
            </tr>
          </thead>
          <tbody>
            {data.users.map((u) => (
              <tr key={u.id} style={{ borderBottom: "1px solid #ddd" }}>
                <td style={{ padding: "0.5rem" }}>{u.email}</td>
                <td style={{ padding: "0.5rem" }}>{u.displayName}</td>
                <td style={{ padding: "0.5rem" }}>
                  <RoleEditor
                    currentRoles={u.roles}
                    onAdd={(role) => addRoleMut.mutate({ id: u.id, role })}
                    onRemove={(role) => removeRoleMut.mutate({ id: u.id, role })}
                  />
                </td>
                <td style={{ padding: "0.5rem" }}>
                  {u.isActive ? t("admin.active") : t("admin.inactive")}
                </td>
                <td style={{ padding: "0.5rem" }}>
                  <button
                    type="button"
                    onClick={() => toggleActiveMut.mutate({ id: u.id, isActive: !u.isActive })}
                    style={{ marginRight: "0.5rem" }}
                  >
                    {u.isActive ? t("admin.deactivate") : t("admin.activate")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const pw = window.prompt(t("admin.newPasswordPrompt") ?? "New password");
                      if (pw && pw.length >= 8) {
                        resetPwMut.mutate({ id: u.id, newPassword: pw });
                      }
                    }}
                  >
                    {t("admin.resetPassword")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function CreateUserForm(props: {
  onSubmit: (v: {
    email: string;
    password: string;
    displayName: string;
    roles: RoleName[];
  }) => void;
  pending: boolean;
  error: unknown;
}) {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<RoleName>("participant");

  function submit(e: FormEvent) {
    e.preventDefault();
    props.onSubmit({ email, password, displayName, roles: [role] });
    setEmail("");
    setDisplayName("");
    setPassword("");
  }

  return (
    <form
      onSubmit={submit}
      style={{
        border: "1px solid #ddd",
        padding: "1rem",
        borderRadius: 8,
        display: "grid",
        gridTemplateColumns: "1fr 1fr auto",
        gap: "0.75rem",
        alignItems: "end",
      }}
    >
      <label>
        {t("admin.colEmail")}
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ display: "block", width: "100%", padding: "0.5rem" }}
        />
      </label>
      <label>
        {t("admin.colDisplayName")}
        <input
          type="text"
          required
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          style={{ display: "block", width: "100%", padding: "0.5rem" }}
        />
      </label>
      <label>
        {t("admin.colRoles")}
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as RoleName)}
          style={{ display: "block", padding: "0.5rem" }}
        >
          {ROLE_NAMES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>
      <label style={{ gridColumn: "1 / span 2" }}>
        {t("auth.passwordLabel")}
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ display: "block", width: "100%", padding: "0.5rem" }}
        />
      </label>
      <button type="submit" disabled={props.pending} style={{ padding: "0.5rem 1rem" }}>
        {props.pending ? t("admin.creating") : t("admin.create")}
      </button>
      {props.error instanceof Error && (
        <p style={{ gridColumn: "1 / -1", color: "#b00020", margin: 0 }}>{props.error.message}</p>
      )}
    </form>
  );
}

function RoleEditor(props: {
  currentRoles: RoleName[];
  onAdd: (role: RoleName) => void;
  onRemove: (role: RoleName) => void;
}) {
  const available = ROLE_NAMES.filter((r) => !props.currentRoles.includes(r));
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem", alignItems: "center" }}>
      {props.currentRoles.map((r) => (
        <span
          key={r}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.25rem",
            padding: "0.15rem 0.5rem",
            border: "1px solid #888",
            borderRadius: 4,
            fontSize: "0.85rem",
          }}
        >
          {r}
          <button
            type="button"
            onClick={() => props.onRemove(r)}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
            aria-label={`remove ${r}`}
          >
            ×
          </button>
        </span>
      ))}
      {available.length > 0 && (
        <select
          defaultValue=""
          onChange={(e) => {
            const value = e.target.value;
            if (value) {
              props.onAdd(value as RoleName);
              e.target.value = "";
            }
          }}
          style={{ fontSize: "0.85rem" }}
        >
          <option value="">+</option>
          {available.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
