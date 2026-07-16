import { MexpError } from "@mexp/shared";

export class InvalidCredentialsError extends MexpError {
  constructor() {
    super("INVALID_CREDENTIALS", "Ungültige Anmeldedaten", 401);
  }
}

export class UserAlreadyExistsError extends MexpError {
  constructor(email: string) {
    super("USER_ALREADY_EXISTS", `Benutzer mit E-Mail ${email} existiert bereits`, 409, { email });
  }
}

export class UserNotFoundError extends MexpError {
  constructor(identifier: string) {
    super("USER_NOT_FOUND", `Benutzer nicht gefunden: ${identifier}`, 404, { identifier });
  }
}

export class UserInactiveError extends MexpError {
  constructor() {
    super("USER_INACTIVE", "Benutzerkonto ist deaktiviert", 403);
  }
}
