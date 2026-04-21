import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import { ApiRequestError, apiFetch } from "../api/client";
import type { AuthUser, RoleName } from "./types";

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  hasRole: (...roles: RoleName[]) => boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchMe(): Promise<AuthUser | null> {
  try {
    const res = await apiFetch<{ user: AuthUser }>("/auth/me");
    return res.user;
  } catch (err) {
    if (err instanceof ApiRequestError && (err.status === 401 || err.status === 404)) {
      return null;
    }
    throw err;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: fetchMe,
    retry: false,
    staleTime: 60_000,
  });

  const value = useMemo<AuthContextValue>(
    () => ({
      user: data ?? null,
      isLoading,
      hasRole: (...roles) => (data ? roles.some((r) => data.roles.includes(r)) : false),
      refresh: async () => {
        await qc.invalidateQueries({ queryKey: ["auth", "me"] });
      },
      logout: async () => {
        await apiFetch("/auth/logout", { method: "POST" });
        qc.setQueryData(["auth", "me"], null);
        await qc.invalidateQueries({ queryKey: ["auth", "me"] });
      },
    }),
    [data, isLoading, qc],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth muss innerhalb von <AuthProvider> verwendet werden");
  return ctx;
}
