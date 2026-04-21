import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/auth-context";

export default function HomePage() {
  const { t } = useTranslation();
  const { user, hasRole } = useAuth();

  return (
    <div style={{ padding: "2rem", fontFamily: "system-ui" }}>
      <h1>{t("app.title")}</h1>
      <p>{t("app.welcome")}</p>
      {user && (
        <p>
          {t("auth.greeting", { name: user.displayName })} —{" "}
          <strong>{user.roles.join(", ")}</strong>
        </p>
      )}
      {hasRole("admin") && (
        <p>
          <Link to="/admin/users">{t("admin.usersLink")}</Link>
        </p>
      )}
    </div>
  );
}
