import { UserNotFoundError } from "@memp/domain";
import { rootLogger } from "@memp/shared";
import type { UserPort } from "../ports.js";

const log = rootLogger.child({ module: "set-user-active" });

export async function setUserActive(
  input: { userId: string; isActive: boolean },
  deps: { users: UserPort; actingUserId: string },
): Promise<void> {
  const user = await deps.users.findById(input.userId);
  if (!user) throw new UserNotFoundError(input.userId);

  await deps.users.setActive(user.id, input.isActive);
  log.info(
    { userId: user.id, isActive: input.isActive, by: deps.actingUserId },
    "User-Aktiv-Status geändert",
  );
}
