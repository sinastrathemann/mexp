import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/auth-context";
import { ProtectedRoute } from "./auth/protected-route";
import AdminUsersPage from "./pages/admin-users";
import HomePage from "./pages/home";
import LoginPage from "./pages/login";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

function TopBar() {
  const { t, i18n } = useTranslation();
  const { user, logout, hasRole } = useAuth();
  return (
    <header
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "0.75rem 2rem",
        borderBottom: "1px solid #ddd",
        fontFamily: "system-ui",
      }}
    >
      <nav style={{ display: "flex", gap: "1rem" }}>
        <Link to="/">{t("app.title")}</Link>
        {hasRole("admin") && <Link to="/admin/users">{t("admin.usersLink")}</Link>}
      </nav>
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
        {user && <span>{user.displayName}</span>}
        <button
          type="button"
          onClick={() => i18n.changeLanguage(i18n.language === "de" ? "en" : "de")}
        >
          {i18n.language === "de" ? "EN" : "DE"}
        </button>
        {user && (
          <button type="button" onClick={() => void logout()}>
            {t("auth.logout")}
          </button>
        )}
      </div>
    </header>
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
