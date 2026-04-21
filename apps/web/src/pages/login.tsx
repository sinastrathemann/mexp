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
    <div className="login-wrap">
      <div className="card login-card">
        <div className="eyebrow">mindsquare · mEMP</div>
        <h1 style={{ marginTop: 0 }}>{t("auth.loginTitle")}</h1>
        <form onSubmit={onSubmit}>
          <div className="field">
            <label className="label" htmlFor="login-email">
              {t("auth.emailLabel")}
            </label>
            <input
              id="login-email"
              className="input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="login-password">
              {t("auth.passwordLabel")}
            </label>
            <input
              id="login-password"
              className="input"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          {error && (
            <div className="alert alert-error" role="alert">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={pending}
            className="btn btn-primary btn-lg"
            style={{ width: "100%" }}
          >
            {pending ? t("auth.loginPending") : t("auth.loginSubmit")}
          </button>
        </form>
      </div>
    </div>
  );
}
