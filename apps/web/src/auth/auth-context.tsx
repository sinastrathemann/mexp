import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import { apiFetch } from "../api/client";
import type { AuthUser, MeRoles, RoleName } from "./types";

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  /** true wenn `/me` mit einem anderen Status als 200/401 fehlgeschlagen ist. */
  isError: boolean;
  /** mEMP-interne Rollen aus `/me/roles` (ohne HubAdmin-Override). */
  mempRoles: RoleName[];
  /** mEMP-interne Rollen inkl. HubAdmin-Override — Basis für `hasRole`. */
  effectiveRoles: RoleName[];
  hasRole: (...roles: RoleName[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Bootstrapt die Session ausschließlich über den Hub: `/me` liefert die
 * Identität aus den X-MSQ-*-Headern. Bei 401 (kein Hub-Header vorhanden, z.B.
 * abgelaufene Session) verlässt die App das SPA-Routing komplett und schickt
 * den Browser zu `/auth/logout` — der Hub fängt das ab und startet die SSO-
 * Anmeldung neu. Es gibt bewusst keinen eigenen Login-/Logout-Endpunkt mehr.
 */
async function fetchMe(): Promise<AuthUser | null> {
  const res = await fetch("/api/me");
  if (res.status === 401) {
    window.location.href = "/auth/logout";
    return null;
  }
  if (!res.ok) {
    throw new Error(`GET /me fehlgeschlagen: HTTP ${res.status}`);
  }
  return (await res.json()) as AuthUser;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["me"],
    queryFn: fetchMe,
    retry: false,
    staleTime: 60_000,
  });

  // Zusätzlich zu `/me` (rohe Hub-Identität) holen wir die mEMP-internen Rollen aus
  // `/me/roles` — das berücksichtigt sowohl den `_user-resolution.ts`-Rollen-Store
  // als auch den HubAdmin-Override, und deckt damit auch Nicht-HubAdmin-Rollen ab,
  // die `/me` (nur X-MSQ-Roles) nicht kennt.
  const { data: rolesData } = useQuery({
    queryKey: ["me", "roles"],
    queryFn: () => apiFetch<MeRoles>("/me/roles"),
    enabled: !!data,
    retry: false,
    staleTime: 60_000,
  });

  const value = useMemo<AuthContextValue>(() => {
    const mempRoles = (rolesData?.mempRoles ?? []) as RoleName[];
    const effectiveRoles = (rolesData?.effectiveRoles ?? mempRoles) as RoleName[];
    return {
      user: data ?? null,
      isLoading,
      isError,
      mempRoles,
      effectiveRoles,
      // effectiveRoles enthält den HubAdmin-Override bereits (siehe /me/roles) —
      // zusätzlich prüfen wir data.isHubAdmin direkt, solange /me/roles noch lädt.
      hasRole: (...roles) =>
        data ? data.isHubAdmin || roles.some((r) => effectiveRoles.includes(r)) : false,
    };
  }, [data, isLoading, isError, rolesData]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth muss innerhalb von <AuthProvider> verwendet werden");
  return ctx;
}
