import { UserNotFoundError } from "@memp/domain";
import { rootLogger } from "@memp/shared";
import type { PasswordHasherPort, UserPort } from "../ports.js";

const log = rootLogger.child({ module: "reset-user-password" });

export async function resetUserPassword(
  input: { userId: string; newPassword: string },
  deps: { users: UserPort; hasher: PasswordHasherPort; actingUserId: string },
): Promise<void> {
  const user = await deps.users.findById(input.userId);
  if (!user) throw new UserNotFoundError(input.userId);

  const newHash = await deps.hasher.hash(input.newPassword);
  await deps.users.updatePassword(user.id, newHash);
  log.info({ userId: user.id, by: deps.actingUserId }, "Passwort zurückgesetzt");
}
