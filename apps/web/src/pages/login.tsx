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

  async function loginWith(emailVal: string, passwordVal: string) {
    setError(null);
    setPending(true);
    try {
      await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: emailVal, password: passwordVal }),
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

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void loginWith(email, password);
  }

  return (
    <div className="sso-wrap">
      <div className="sso-card">
        <div className="eyebrow">mindsquare · mEMP</div>
        <h1 className="sso-title" style={{ fontSize: "var(--text-2xl)" }}>
          {t("auth.loginTitle")}
        </h1>
        <p className="sso-sub">Melde dich mit deiner mindsquare E-Mail an.</p>

        <form onSubmit={onSubmit} style={{ textAlign: "left" }}>
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
              placeholder="vorname.nachname@mindsquare.de"
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
              placeholder="••••••••"
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
            style={{ width: "100%", marginTop: "var(--space-2)" }}
          >
            {pending ? t("auth.loginPending") : t("auth.loginSubmit")} →
          </button>
        </form>

        <div className="sso-divider" style={{ marginTop: "var(--space-6)" }}>
          <span>Test-Accounts</span>
        </div>

        <div className="sso-quick-grid">
          <button
            type="button"
            className="sso-quick-btn"
            disabled={pending}
            onClick={() => loginWith("sina.strathemann@mindsquare.de", "password")}
          >
            <span className="sso-quick-avatar sso-quick-avatar-admin" aria-hidden="true">S</span>
            <span className="sso-quick-info">
              <span className="sso-quick-name">Sina (Dev)</span>
              <span className="sso-quick-role">Admin</span>
            </span>
          </button>
          <button
            type="button"
            className="sso-quick-btn"
            disabled={pending}
            onClick={() => loginWith("max.mustermann@mindsquare.de", "password")}
          >
            <span className="sso-quick-avatar sso-quick-avatar-user" aria-hidden="true">M</span>
            <span className="sso-quick-info">
              <span className="sso-quick-name">Max Mustermann</span>
              <span className="sso-quick-role">Mitarbeiter</span>
            </span>
          </button>
          <button
            type="button"
            className="sso-quick-btn"
            disabled={pending}
            onClick={() => loginWith("lisa.werkstudi@mindsquare.de", "password")}
          >
            <span className="sso-quick-avatar sso-quick-avatar-user" aria-hidden="true">L</span>
            <span className="sso-quick-info">
              <span className="sso-quick-name">Lisa (Werkstudentin)</span>
              <span className="sso-quick-role">Werkstudent</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
