import type { RoleName } from "./role.js";

export interface User {
  id: string;
  email: string;
  displayName: string;
  isActive: boolean;
  roles: RoleName[];
  createdAt: Date;
  lastLoginAt: Date | null;
}

export interface UserWithPasswordHash extends User {
  passwordHash: string;
}
