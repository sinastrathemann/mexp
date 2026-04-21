export const ROLE_NAMES = [
  "read_only",
  "participant",
  "event_office",
  "budget_owner",
  "manager",
  "admin",
] as const;

export type RoleName = (typeof ROLE_NAMES)[number];

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  isActive: boolean;
  roles: RoleName[];
  lastLoginAt: string | null;
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
