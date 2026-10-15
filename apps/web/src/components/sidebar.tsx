import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router-dom";
import { ADMIN_AREA_ROLES } from "../admin/role-order";
import { apiFetch } from "../api/client";
import logoUrl from "../assets/logo-mindsquare.png";
import { useAuth } from "../auth/auth-context";

export function Sidebar() {
  const { t, i18n } = useTranslation();
  const { user, hasRole } = useAuth();

  // Admins/Manager/EventOffice sehen die KPI-Dashboard-Seite als Startseite,
  // normale Teilnehmer sehen ihre persönliche Home-Seite ("Hallo, ...").
  // Logo + erster Sidebar-Menüpunkt führen beide zum jeweils passenden Ziel —
  // so gibt's genau EIN Dashboard pro User statt zwei parallel.
  const isPrivileged = hasRole("admin", "manager", "event_office");
  const homeRoute = isPrivileged ? "/dashboard" : "/";

  // "Ping" für das Event-Team: neue Eventanfragen + mir zugewiesene offene Anfragen.
  // Pollt jede Minute, damit neue Anfragen ohne Reload auftauchen.
  const canManageRequests = hasRole("admin", "manager", "event_office", "werkstudent");
  const pendingQ = useQuery({
    queryKey: ["event-requests", "pending-count"],
    queryFn: () =>
      apiFetch<{ submitted: number; assignedToMe: number }>("/event-requests/pending-count"),
    enabled: canManageRequests,
    refetchInterval: 60_000,
  });
  const pendingRequests = (pendingQ.data?.submitted ?? 0) + (pendingQ.data?.assignedToMe ?? 0);
  const homeLabel = isPrivileged
    ? t("dashboard.navLink")
    : i18n.language === "de"
      ? "Startseite"
      : "Home";

  return (
    <aside className="ms-sidebar">
      <NavLink to={homeRoute} className="ms-sidebar-logo">
        <img src={logoUrl} alt="mindsquare" />
        <span className="ms-sidebar-logo-sub">mEXP</span>
      </NavLink>

      <nav className="ms-sidebar-nav">
        {user && (
          <NavLink
            to={homeRoute}
            end
            className={({ isActive }) => `ms-sidebar-link${isActive ? " active" : ""}`}
          >
            {homeLabel}
          </NavLink>
        )}
        {user && (
          <NavLink
            to="/events"
            className={({ isActive }) => `ms-sidebar-link${isActive ? " active" : ""}`}
          >
            {t("events.navLink")}
          </NavLink>
        )}
        {user && (
          <NavLink
            to="/event-requests"
            className={({ isActive }) => `ms-sidebar-link${isActive ? " active" : ""}`}
          >
            {t("eventRequests.navLink")}
            {pendingRequests > 0 && (
              <span
                className="badge badge-orange"
                style={{ marginLeft: 8 }}
                title={t("eventRequests.pendingBadge", { count: pendingRequests })}
              >
                {pendingRequests}
              </span>
            )}
          </NavLink>
        )}
        {hasRole("admin", "manager", "event_office") && (
          <NavLink
            to="/reports"
            className={({ isActive }) => `ms-sidebar-link${isActive ? " active" : ""}`}
          >
            Reports
          </NavLink>
        )}
        {hasRole(...ADMIN_AREA_ROLES) && (
          <NavLink
            to="/admin"
            className={({ isActive }) => `ms-sidebar-link${isActive ? " active" : ""}`}
          >
            {t("admin.navLink")}
          </NavLink>
        )}
      </nav>

      <div className="ms-sidebar-footer">
        {user && (
          <div className="ms-sidebar-user">
            <span className="ms-sidebar-user-avatar" aria-hidden="true" />
            <span className="ms-sidebar-user-name">{user.name}</span>
          </div>
        )}
        <div className="ms-sidebar-actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => i18n.changeLanguage(i18n.language === "de" ? "en" : "de")}
          >
            {i18n.language === "de" ? "EN" : "DE"}
          </button>
          {user && (
            <a href="/auth/logout" className="btn btn-outline btn-sm">
              {t("auth.logout")}
            </a>
          )}
        </div>
      </div>
    </aside>
  );
}
