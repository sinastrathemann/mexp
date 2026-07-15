export const ROLE_NAMES = [
  "read_only",
  "participant",
  "werkstudent",
  "event_office",
  "budget_owner",
  "manager",
  "admin",
] as const;

export type RoleName = (typeof ROLE_NAMES)[number];

/**
 * Hub-Identität, wie sie `GET /me` liefert (siehe apps/api/src/routes/auth.ts).
 * `roles`/`groups` sind Rohwerte aus den X-MSQ-*-Headern (Entra/AppHub-Rollen) —
 * NICHT dieselben Werte wie `RoleName` (mEMP-interne Rollen, verwaltet über
 * /admin/users). Hub-Admins (`isHubAdmin`) werden serverseitig überall als
 * mEMP-"admin" behandelt (siehe requireMempRole) — das spiegelt `hasRole` unten.
 */
export interface AuthUser {
  id: string;
  email: string | null;
  name: string | null;
  roles: string[];
  groups: string[];
  isHubAdmin: boolean;
  isGuest: boolean;
  authTime: string | null;
}

export interface AdminUserRow {
  id: string;
  email: string;
  displayName: string;
  isActive: boolean;
  roles: RoleName[];
  createdAt: string;
  lastLoginAt: string | null;
}
