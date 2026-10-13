import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../api/client";
import { ROLE_NAMES } from "../auth/types";
import type { AdminUserRow, RoleName } from "../auth/types";
import type { UserSearchResult } from "../events/types";
import { RoleLegend } from "./role-legend";

export function UsersPanel() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => apiFetch<{ users: AdminUserRow[] }>("/admin/users"),
  });

  // Ausgetretene bleiben im Bestand, damit alte Teilnehmerlisten weiter Namen
  // statt Luecken zeigen (siehe admin-personio.ts) -- im Alltag stoeren sie
  // aber. Deshalb standardmaessig ausgeblendet, auf Wunsch einblendbar.
  const [showInactive, setShowInactive] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [selectedRole, setSelectedRole] = useState<RoleName>("event_office");
  const activeUsers = (data?.users ?? []).filter((user) => showInactive || user.isActive !== false);
  const roleAssignedUsers = activeUsers.filter((user) =>
    user.roles.some((role) => role !== "participant"),
  );
  const visibleUsers = showParticipants ? activeUsers : roleAssignedUsers;
  const hiddenParticipantCount = activeUsers.length - roleAssignedUsers.length;

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "users"] });

  const userSearch = useQuery({
    queryKey: ["admin", "user-search", searchTerm],
    queryFn: () =>
      apiFetch<{ users: UserSearchResult[] }>(
        `/users/search?q=${encodeURIComponent(searchTerm.trim())}&limit=10`,
      ),
    enabled: searchTerm.trim().length >= 2,
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
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["admin", "user-search"] });
      setSearchTerm("");
      setSelectedUser(null);
    },
  });

  const removeRoleMut = useMutation({
    mutationFn: (input: { id: string; role: RoleName }) =>
      apiFetch(`/admin/users/${input.id}/roles/${input.role}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  return (
    <>
      <h2 style={{ marginTop: 0 }}>{t("admin.usersListTitle")}</h2>
      <RoleLegend />
      <section className="card" aria-labelledby="admin-find-user-title">
        <h3 id="admin-find-user-title" className="card-title" style={{ marginTop: 0 }}>
          {t("admin.findUserTitle")}
        </h3>
        <p className="help-text">{t("admin.findUserHint")}</p>
        <div className="field">
          <label className="label" htmlFor="admin-user-search">
            {t("admin.searchUser")}
          </label>
          <input
            id="admin-user-search"
            className="input"
            type="search"
            autoComplete="off"
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value);
              setSelectedUser(null);
            }}
            placeholder={t("admin.searchUserPlaceholder")}
          />
        </div>
        {searchTerm.trim().length >= 2 && userSearch.isLoading && (
          <div className="muted text-sm">{t("admin.searchingUsers")}</div>
        )}
        {userSearch.error instanceof Error && (
          <div className="alert alert-error">{userSearch.error.message}</div>
        )}
        {searchTerm.trim().length >= 2 && userSearch.data?.users.length === 0 && (
          <div className="muted text-sm">{t("admin.noUsersFound")}</div>
        )}
        {userSearch.data?.users.length && !selectedUser ? (
          <ul
            aria-label={t("admin.searchResults")}
            style={{
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-md)",
              overflow: "hidden",
              maxHeight: 300,
              overflowY: "auto",
              listStyle: "none",
              margin: 0,
              padding: 0,
            }}
          >
            {userSearch.data.users.map((user) => (
              <li key={user.id} style={{ listStyle: "none" }}>
                <button
                  type="button"
                  className="row"
                  style={{
                    width: "100%",
                    justifyContent: "space-between",
                    padding: "var(--space-3) var(--space-4)",
                    border: 0,
                    borderBottom: "1px solid var(--border-default)",
                    background: "transparent",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                  onClick={() => setSelectedUser(user)}
                >
                  <span>
                    <strong>{user.displayName}</strong>
                    <span className="muted" style={{ display: "block" }}>
                      {user.email ?? user.id}
                    </span>
                  </span>
                  <span className="muted">
                    {[user.department, user.team].filter(Boolean).join(" · ")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {selectedUser && (
          <div className="field-row" style={{ alignItems: "flex-end" }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <div className="label">{t("admin.selectedUser")}</div>
              <div className="text-bold">{selectedUser.displayName}</div>
              <div className="muted text-sm">{selectedUser.email ?? selectedUser.id}</div>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label className="label" htmlFor="admin-selected-role">
                {t("admin.assignRole")}
              </label>
              <select
                id="admin-selected-role"
                className="select"
                value={selectedRole}
                onChange={(event) => setSelectedRole(event.target.value as RoleName)}
              >
                {ROLE_NAMES.filter((role) => role !== "participant").map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              disabled={addRoleMut.isPending}
              onClick={() => addRoleMut.mutate({ id: selectedUser.id, role: selectedRole })}
            >
              {addRoleMut.isPending ? t("admin.assigningRole") : t("admin.grantRole")}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setSelectedUser(null)}
              aria-label={t("common.cancel")}
            >
              ×
            </button>
          </div>
        )}
        {addRoleMut.error instanceof Error && (
          <div className="alert alert-error" style={{ marginTop: "var(--space-3)" }}>
            {addRoleMut.error.message}
          </div>
        )}
      </section>
      {isLoading && <div className="card muted">{t("auth.loading")}</div>}
      {data && (
        <div className="row" style={{ gap: 20, marginBottom: "var(--space-3)" }}>
          <label className="row" style={{ gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={showParticipants}
              onChange={(event) => setShowParticipants(event.target.checked)}
            />
            <span>
              {t("admin.showParticipants")}
              {!showParticipants && hiddenParticipantCount > 0 && (
                <span className="muted">
                  {" "}
                  {t("admin.hiddenCount", { hidden: hiddenParticipantCount })}
                </span>
              )}
            </span>
          </label>
          <label className="row" style={{ gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(event) => setShowInactive(event.target.checked)}
            />
            <span>{t("admin.showInactive")}</span>
          </label>
        </div>
      )}
      {data && visibleUsers.length === 0 && (
        <div className="card muted">
          {t(showParticipants ? "admin.noUsers" : "admin.noUsersWithRoles")}
        </div>
      )}
      {data && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="table">
            <thead>
              <tr>
                <th>{t("admin.colEmail")}</th>
                <th>{t("admin.colDisplayName")}</th>
                <th>{t("admin.colRoles")}</th>
                <th>{t("admin.colStatus")}</th>
                <th>{t("admin.colLastSeen")}</th>
                <th>{t("admin.colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {visibleUsers.map((u) => (
                <tr key={u.id}>
                  <td className="text-bold">{u.email}</td>
                  <td>
                    {u.displayName}
                    {u.personioId && (
                      <div className="row" style={{ gap: 6, marginTop: 4 }}>
                        <span className="badge badge-cobalt">{t("admin.personioBadge")}</span>
                        {u.department && (
                          <span className="badge badge-outline">{u.department}</span>
                        )}
                      </div>
                    )}
                    {u.sharepointStudiId && (
                      <div className="row" style={{ gap: 6, marginTop: 4 }}>
                        <span className="badge badge-cobalt">{t("admin.sharepointBadge")}</span>
                        {u.team && <span className="badge badge-outline">{u.team}</span>}
                      </div>
                    )}
                    {u.csvImportedAt && (
                      <div className="row" style={{ gap: 6, marginTop: 4 }}>
                        <span className="badge badge-cobalt">{t("admin.csvBadge")}</span>
                      </div>
                    )}
                  </td>
                  <td>
                    <RoleEditor
                      currentRoles={u.roles}
                      onAdd={(role) => addRoleMut.mutate({ id: u.id, role })}
                      onRemove={(role) => removeRoleMut.mutate({ id: u.id, role })}
                    />
                  </td>
                  <td>
                    <span className={u.isActive ? "badge badge-success" : "badge badge-muted"}>
                      {u.isActive ? t("admin.active") : t("admin.inactive")}
                    </span>
                  </td>
                  <td>
                    {u.lastSeenAt
                      ? new Date(u.lastSeenAt).toLocaleString(i18n.language)
                      : t("admin.neverSeen")}
                  </td>
                  <td>
                    <div className="row" style={{ gap: "var(--space-2)" }}>
                      <button
                        type="button"
                        onClick={() => toggleActiveMut.mutate({ id: u.id, isActive: !u.isActive })}
                        className="btn btn-outline btn-sm"
                      >
                        {u.isActive ? t("admin.deactivate") : t("admin.activate")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function RoleEditor(props: {
  currentRoles: RoleName[];
  onAdd: (role: RoleName) => void;
  onRemove: (role: RoleName) => void;
}) {
  const currentRoles = props.currentRoles.filter((role) => role !== "participant");
  const available = ROLE_NAMES.filter(
    (role) => role !== "participant" && !currentRoles.includes(role),
  );
  return (
    <div className="row" style={{ gap: "var(--space-2)" }}>
      {currentRoles.map((r) => (
        <span key={r} className="badge badge-orange" style={{ gap: 4 }}>
          {r}
          <button
            type="button"
            onClick={() => props.onRemove(r)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              color: "inherit",
              marginLeft: 4,
            }}
            aria-label={`remove ${r}`}
          >
            ×
          </button>
        </span>
      ))}
      {available.length > 0 && (
        <select
          className="select"
          defaultValue=""
          style={{ width: "auto", fontSize: "var(--text-xs)", padding: "2px 8px" }}
          onChange={(e) => {
            const value = e.target.value;
            if (value) {
              props.onAdd(value as RoleName);
              e.target.value = "";
            }
          }}
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
