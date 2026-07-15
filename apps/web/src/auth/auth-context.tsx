import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import type { AuthUser, RoleName } from "./types";

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  /** true wenn `/me` mit einem anderen Status als 200/401 fehlgeschlagen ist. */
  isError: boolean;
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

  const value = useMemo<AuthContextValue>(
    () => ({
      user: data ?? null,
      isLoading,
      isError,
      // Hub-Admins besitzen serverseitig immer mEMP-"admin" (requireMempRole) —
      // das spiegeln wir hier, damit UI-Gating und Backend-Enforcement übereinstimmen.
      hasRole: (...roles) =>
        data ? data.isHubAdmin || roles.some((r) => data.roles.includes(r)) : false,
    }),
    [data, isLoading, isError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth muss innerhalb von <AuthProvider> verwendet werden");
  return ctx;
}
