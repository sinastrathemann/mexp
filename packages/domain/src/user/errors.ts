import { MempError } from "@memp/shared";

export class InvalidCredentialsError extends MempError {
  constructor() {
    super("INVALID_CREDENTIALS", "Ungültige Anmeldedaten", 401);
  }
}

export class UserAlreadyExistsError extends MempError {
  constructor(email: string) {
    super("USER_ALREADY_EXISTS", `Benutzer mit E-Mail ${email} existiert bereits`, 409, { email });
  }
}

export class UserNotFoundError extends MempError {
  constructor(identifier: string) {
    super("USER_NOT_FOUND", `Benutzer nicht gefunden: ${identifier}`, 404, { identifier });
  }
}

export class UserInactiveError extends MempError {
  constructor() {
    super("USER_INACTIVE", "Benutzerkonto ist deaktiviert", 403);
  }
}
