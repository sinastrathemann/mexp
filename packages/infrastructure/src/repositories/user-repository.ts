import type { RoleName, User, UserWithPasswordHash } from "@memp/domain";
import { isRoleName } from "@memp/domain";
import { and, eq } from "drizzle-orm";
import type { DbClient } from "../db/client.js";
import { roles, userRoles, users } from "../db/schema/tables.js";

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  displayName: string;
}

export class UserRepository {
  constructor(private readonly db: DbClient) {}

  async findByEmail(email: string): Promise<UserWithPasswordHash | null> {
    const rows = await this.db
      .select({
        userId: users.id,
        email: users.email,
        passwordHash: users.passwordHash,
        displayName: users.displayName,
        isActive: users.isActive,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
        roleName: roles.name,
      })
      .from(users)
      .leftJoin(userRoles, eq(userRoles.userId, users.id))
      .leftJoin(roles, eq(roles.id, userRoles.roleId))
      .where(eq(users.email, email));

    return rowsToUserWithHash(rows);
  }

  async findById(id: string): Promise<User | null> {
    const rows = await this.db
      .select({
        userId: users.id,
        email: users.email,
        displayName: users.displayName,
        isActive: users.isActive,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
        roleName: roles.name,
      })
      .from(users)
      .leftJoin(userRoles, eq(userRoles.userId, users.id))
      .leftJoin(roles, eq(roles.id, userRoles.roleId))
      .where(eq(users.id, id));

    return rowsToUser(rows);
  }

  async list(): Promise<User[]> {
    const rows = await this.db
      .select({
        userId: users.id,
        email: users.email,
        displayName: users.displayName,
        isActive: users.isActive,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
        roleName: roles.name,
      })
      .from(users)
      .leftJoin(userRoles, eq(userRoles.userId, users.id))
      .leftJoin(roles, eq(roles.id, userRoles.roleId))
      .orderBy(users.createdAt);

    const byUserId = new Map<string, User>();
    for (const r of rows) {
      let u = byUserId.get(r.userId);
      if (!u) {
        u = {
          id: r.userId,
          email: r.email,
          displayName: r.displayName,
          isActive: r.isActive,
          createdAt: r.createdAt,
          lastLoginAt: r.lastLoginAt,
          roles: [],
        };
        byUserId.set(r.userId, u);
      }
      if (r.roleName && isRoleName(r.roleName) && !u.roles.includes(r.roleName)) {
        u.roles.push(r.roleName);
      }
    }
    return [...byUserId.values()];
  }

  async create(input: CreateUserInput): Promise<User> {
    const [row] = await this.db
      .insert(users)
      .values({
        email: input.email,
        passwordHash: input.passwordHash,
        displayName: input.displayName,
        isActive: true,
      })
      .returning();
    if (!row) throw new Error("User-Insert lieferte keine Zeile zurück.");
    return {
      id: row.id,
      email: row.email,
      displayName: row.displayName,
      isActive: row.isActive,
      createdAt: row.createdAt,
      lastLoginAt: row.lastLoginAt,
      roles: [],
    };
  }

  async updatePassword(userId: string, newPasswordHash: string): Promise<void> {
    await this.db
      .update(users)
      .set({ passwordHash: newPasswordHash, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  async setActive(userId: string, isActive: boolean): Promise<void> {
    await this.db
      .update(users)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, userId));
  }

  async assignRole(userId: string, roleId: string, assignedBy: string): Promise<void> {
    await this.db
      .insert(userRoles)
      .values({ userId, roleId, assignedBy })
      .onConflictDoNothing();
  }

  async removeRole(userId: string, roleId: string): Promise<void> {
    await this.db
      .delete(userRoles)
      .where(and(eq(userRoles.userId, userId), eq(userRoles.roleId, roleId)));
  }
}

type UserJoinRow = {
  userId: string;
  email: string;
  passwordHash: string;
  displayName: string;
  isActive: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
  roleName: string | null;
};

function rowsToUserWithHash(rows: UserJoinRow[]): UserWithPasswordHash | null {
  const first = rows[0];
  if (!first) return null;
  const roleNames: RoleName[] = [];
  for (const r of rows) {
    if (r.roleName && isRoleName(r.roleName) && !roleNames.includes(r.roleName)) {
      roleNames.push(r.roleName);
    }
  }
  return {
    id: first.userId,
    email: first.email,
    passwordHash: first.passwordHash,
    displayName: first.displayName,
    isActive: first.isActive,
    createdAt: first.createdAt,
    lastLoginAt: first.lastLoginAt,
    roles: roleNames,
  };
}

function rowsToUser(
  rows: Omit<UserJoinRow, "passwordHash">[],
): User | null {
  const first = rows[0];
  if (!first) return null;
  const roleNames: RoleName[] = [];
  for (const r of rows) {
    if (r.roleName && isRoleName(r.roleName) && !roleNames.includes(r.roleName)) {
      roleNames.push(r.roleName);
    }
  }
  return {
    id: first.userId,
    email: first.email,
    displayName: first.displayName,
    isActive: first.isActive,
    createdAt: first.createdAt,
    lastLoginAt: first.lastLoginAt,
    roles: roleNames,
  };
}
