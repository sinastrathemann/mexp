import { InvalidCredentialsError, UserInactiveError } from "@mexp/domain";
import type { User } from "@mexp/domain";
import { rootLogger } from "@mexp/shared";
import type { PasswordHasherPort, UserPort } from "../ports.js";

const log = rootLogger.child({ module: "login-user" });

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginDeps {
  users: UserPort;
  hasher: PasswordHasherPort;
}

export async function loginUser(input: LoginInput, deps: LoginDeps): Promise<User> {
  const user = await deps.users.findByEmail(input.email.toLowerCase().trim());
  if (!user) {
    log.warn({ email: input.email }, "Login: Benutzer nicht gefunden");
    throw new InvalidCredentialsError();
  }
  if (!user.isActive) {
    log.warn({ userId: user.id }, "Login: Benutzer deaktiviert");
    throw new UserInactiveError();
  }
  const ok = await deps.hasher.verify(user.passwordHash, input.password);
  if (!ok) {
    log.warn({ userId: user.id }, "Login: Passwort falsch");
    throw new InvalidCredentialsError();
  }

  await deps.users.updateLastLogin(user.id);
  log.info({ userId: user.id }, "Login erfolgreich");

  const { passwordHash: _ph, ...publicUser } = user;
  return publicUser;
}
