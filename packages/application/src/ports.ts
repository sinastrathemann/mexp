import type { Role, RoleName, User, UserWithPasswordHash } from "@memp/domain";

export interface UserPort {
  findByEmail(email: string): Promise<UserWithPasswordHash | null>;
  findById(id: string): Promise<User | null>;
  list(): Promise<User[]>;
  create(input: {
    email: string;
    passwordHash: string;
    displayName: string;
  }): Promise<User>;
  updatePassword(userId: string, newHash: string): Promise<void>;
  setActive(userId: string, isActive: boolean): Promise<void>;
  updateLastLogin(userId: string): Promise<void>;
  assignRole(userId: string, roleId: string, assignedBy: string): Promise<void>;
  removeRole(userId: string, roleId: string): Promise<void>;
}

export interface RolePort {
  listAll(): Promise<Role[]>;
  findByName(name: RoleName): Promise<Role | null>;
}

export interface PasswordHasherPort {
  hash(plain: string): Promise<string>;
  verify(hash: string, plain: string): Promise<boolean>;
}
