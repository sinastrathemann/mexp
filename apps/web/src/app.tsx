import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { BrowserRouter, NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/auth-context";
import { ProtectedRoute } from "./auth/protected-route";
import AdminUsersPage from "./pages/admin-users";
import BlueprintsPage from "./pages/blueprints";
import DashboardPage from "./pages/dashboard";
import EventCreatePage from "./pages/event-create";
import EventDetailPage from "./pages/event-detail";
import EventsListPage from "./pages/events-list";
import HomePage from "./pages/home";
import LoginPage from "./pages/login";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

function TopBar() {
  const { t, i18n } = useTranslation();
  const { user, logout, hasRole } = useAuth();
  const location = useLocation();
  const isLogin = location.pathname === "/login";

  return (
    <div className="ms-topbar-wrap">
      <div className="ms-topbar-utility">
        <span className="text-bold">mindsquare AG</span>
        <span>mEMP · Event Management</span>
      </div>
      <div className="ms-topbar">
        <NavLink to={user ? "/dashboard" : "/"} className="ms-logo">
          <img src="/logo-mindsquare.png" alt="mindsquare" />
        </NavLink>
        {!isLogin && (
          <nav className="ms-nav-links">
            {user && (
              <NavLink
                to="/dashboard"
                className={({ isActive }) => `ms-nav-link${isActive ? " active" : ""}`}
              >
                {t("dashboard.navLink")}
              </NavLink>
            )}
            {user && (
              <NavLink
                to="/events"
                className={({ isActive }) => `ms-nav-link${isActive ? " active" : ""}`}
              >
                {t("events.navLink")}
              </NavLink>
            )}
            {hasRole("admin", "manager", "event_office") && (
              <NavLink
                to="/blueprints"
                className={({ isActive }) => `ms-nav-link${isActive ? " active" : ""}`}
              >
                {t("blueprints.navLink")}
              </NavLink>
            )}
            {hasRole("admin") && (
              <NavLink
                to="/admin/users"
                className={({ isActive }) => `ms-nav-link${isActive ? " active" : ""}`}
              >
                {t("admin.usersLink")}
              </NavLink>
            )}
          </nav>
        )}
        <div className="ms-nav-actions">
          {user && <span className="ms-nav-user">{user.displayName}</span>}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => i18n.changeLanguage(i18n.language === "de" ? "en" : "de")}
          >
            {i18n.language === "de" ? "EN" : "DE"}
          </button>
          {user && (
            <button type="button" className="btn btn-outline btn-sm" onClick={() => void logout()}>
              {t("auth.logout")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Shell() {
  return (
    <>
      <TopBar />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/events"
          element={
            <ProtectedRoute>
              <EventsListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/events/new"
          element={
            <ProtectedRoute roles={["admin", "manager", "event_office"]}>
              <EventCreatePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/events/:id"
          element={
            <ProtectedRoute>
              <EventDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/blueprints"
          element={
            <ProtectedRoute roles={["admin", "manager", "event_office"]}>
              <BlueprintsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute roles={["admin"]}>
              <AdminUsersPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Shell />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
