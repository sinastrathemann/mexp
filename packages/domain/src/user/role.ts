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

export function isRoleName(value: string): value is RoleName {
  return (ROLE_NAMES as readonly string[]).includes(value);
}

export interface Role {
  id: string;
  name: RoleName;
  description: string;
}
