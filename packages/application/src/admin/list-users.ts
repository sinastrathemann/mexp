import type { User } from "@mexp/domain";
import type { UserPort } from "../ports.js";

export async function listUsers(deps: { users: UserPort }): Promise<User[]> {
  return deps.users.list();
}
