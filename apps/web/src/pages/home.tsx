import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/auth-context";

export default function HomePage() {
  const { t } = useTranslation();
  const { user, hasRole } = useAuth();

  return (
    <>
      <div className="hero">
        <div className="eyebrow">mindsquare · mEMP</div>
        <h1>{t("app.title")}</h1>
        <p className="muted" style={{ maxWidth: 640, margin: "0 auto" }}>
          {t("app.welcome")}
        </p>
        {user && (
          <p style={{ marginTop: "var(--space-4)" }}>
            {t("auth.greeting", { name: user.displayName })} —{" "}
            <span className="badge badge-orange">{user.roles.join(", ")}</span>
          </p>
        )}
        <div className="row" style={{ justifyContent: "center", marginTop: "var(--space-6)" }}>
          <Link to="/dashboard" className="btn btn-primary">
            {t("dashboard.navLink")}
          </Link>
          <Link to="/events" className="btn btn-outline-orange">
            {t("events.navLink")}
          </Link>
          {hasRole("admin") && (
            <Link to="/admin/users" className="btn btn-ghost">
              {t("admin.usersLink")} →
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
