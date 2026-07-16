import type { RoleName } from "@mexp/domain";
import { UserNotFoundError } from "@mexp/domain";
import { NotFoundError, rootLogger } from "@mexp/shared";
import type { RolePort, UserPort } from "../ports.js";

const log = rootLogger.child({ module: "assign-role" });

export interface AssignRoleInput {
  userId: string;
  roleName: RoleName;
}

export interface AssignRoleDeps {
  users: UserPort;
  roles: RolePort;
  actingUserId: string;
}

export async function assignRole(input: AssignRoleInput, deps: AssignRoleDeps): Promise<void> {
  const user = await deps.users.findById(input.userId);
  if (!user) throw new UserNotFoundError(input.userId);

  const role = await deps.roles.findByName(input.roleName);
  if (!role) throw new NotFoundError("Role", input.roleName);

  await deps.users.assignRole(user.id, role.id, deps.actingUserId);
  log.info({ userId: user.id, role: input.roleName, by: deps.actingUserId }, "Rolle zugewiesen");
}

export async function removeRole(input: AssignRoleInput, deps: AssignRoleDeps): Promise<void> {
  const role = await deps.roles.findByName(input.roleName);
  if (!role) throw new NotFoundError("Role", input.roleName);

  await deps.users.removeRole(input.userId, role.id);
  log.info({ userId: input.userId, role: input.roleName, by: deps.actingUserId }, "Rolle entfernt");
}
