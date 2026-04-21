import type { RoleName, User } from "@memp/domain";
import { UserAlreadyExistsError } from "@memp/domain";
import { rootLogger } from "@memp/shared";
import type { PasswordHasherPort, RolePort, UserPort } from "../ports.js";

const log = rootLogger.child({ module: "create-user" });

export interface CreateUserInput {
  email: string;
  password: string;
  displayName: string;
  roles?: RoleName[];
}

export interface CreateUserDeps {
  users: UserPort;
  roles: RolePort;
  hasher: PasswordHasherPort;
  actingUserId: string;
}

export async function createUser(
  input: CreateUserInput,
  deps: CreateUserDeps,
): Promise<User> {
  const email = input.email.toLowerCase().trim();
  const existing = await deps.users.findByEmail(email);
  if (existing) {
    throw new UserAlreadyExistsError(email);
  }

  const passwordHash = await deps.hasher.hash(input.password);
  const created = await deps.users.create({
    email,
    passwordHash,
    displayName: input.displayName.trim(),
  });

  for (const roleName of input.roles ?? []) {
    const role = await deps.roles.findByName(roleName);
    if (!role) continue;
    await deps.users.assignRole(created.id, role.id, deps.actingUserId);
  }

  log.info(
    { userId: created.id, email: created.email, roles: input.roles ?? [] },
    "Benutzer angelegt",
  );

  const refreshed = await deps.users.findById(created.id);
  return refreshed ?? created;
}
