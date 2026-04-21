import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./auth-context";
import type { RoleName } from "./types";

interface Props {
  children: ReactNode;
  roles?: RoleName[];
}

export function ProtectedRoute({ children, roles }: Props) {
  const { user, isLoading, hasRole } = useAuth();
  const location = useLocation();
  const { t } = useTranslation();

  if (isLoading) {
    return <p style={{ padding: "2rem" }}>{t("auth.loading")}</p>;
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (roles && roles.length > 0 && !hasRole(...roles)) {
    return (
      <div style={{ padding: "2rem" }}>
        <h2>{t("auth.forbiddenTitle")}</h2>
        <p>{t("auth.forbiddenBody")}</p>
      </div>
    );
  }
  return <>{children}</>;
}
