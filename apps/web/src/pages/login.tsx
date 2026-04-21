import { useState } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { ApiRequestError, apiFetch } from "../api/client";
import { useAuth } from "../auth/auth-context";

export default function LoginPage() {
  const { t } = useTranslation();
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (user) return <Navigate to={from} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      await refresh();
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(
          err.code === "INVALID_CREDENTIALS"
            ? t("auth.errorInvalid")
            : err.code === "USER_INACTIVE"
              ? t("auth.errorInactive")
              : err.message,
        );
      } else {
        setError(t("auth.errorGeneric"));
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      style={{
        maxWidth: 420,
        margin: "4rem auto",
        padding: "2rem",
        border: "1px solid #ddd",
        borderRadius: 8,
        fontFamily: "system-ui",
      }}
    >
      <h1 style={{ marginTop: 0 }}>{t("auth.loginTitle")}</h1>
      <form onSubmit={onSubmit}>
        <label style={{ display: "block", marginBottom: "1rem" }}>
          {t("auth.emailLabel")}
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            style={{ display: "block", width: "100%", padding: "0.5rem", marginTop: "0.25rem" }}
          />
        </label>
        <label style={{ display: "block", marginBottom: "1rem" }}>
          {t("auth.passwordLabel")}
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            style={{ display: "block", width: "100%", padding: "0.5rem", marginTop: "0.25rem" }}
          />
        </label>
        {error && (
          <p style={{ color: "#b00020", marginBottom: "1rem" }} role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          style={{ width: "100%", padding: "0.75rem", fontSize: "1rem" }}
        >
          {pending ? t("auth.loginPending") : t("auth.loginSubmit")}
        </button>
      </form>
    </div>
  );
}
