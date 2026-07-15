export class MempError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly context?: Record<string, unknown>;

  constructor(code: string, message: string, statusCode = 500, context?: Record<string, unknown>) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    if (context !== undefined) {
      this.context = context;
    }
  }
}

export class ValidationError extends MempError {
  constructor(message: string, context?: Record<string, unknown>) {
    super("VALIDATION_ERROR", message, 400, context);
  }
}

export class NotFoundError extends MempError {
  constructor(entity: string, id: string | number) {
    super("NOT_FOUND", `${entity} not found: ${id}`, 404, { entity, id });
  }
}

export class UnauthorizedError extends MempError {
  constructor(message = "Unauthorized") {
    super("UNAUTHORIZED", message, 401);
  }
}

export class ForbiddenError extends MempError {
  constructor(message = "Forbidden") {
    super("FORBIDDEN", message, 403);
  }
}

export class ConflictError extends MempError {
  constructor(message: string, context?: Record<string, unknown>) {
    super("CONFLICT", message, 409, context);
  }
}

export class IntegrationError extends MempError {
  constructor(system: string, message: string, context?: Record<string, unknown>) {
    super("INTEGRATION_ERROR", `[${system}] ${message}`, 502, { system, ...context });
  }
}

// Postgres ist im MVP Follow-up (Design-Spec §2 Non-Goals) — die Standard-Persistenz
// läuft über JSON-Files im Volume. Diese Fehlerklasse markiert Endpunkte, die (noch)
// echtes Postgres brauchen, aber ohne DATABASE_URL aufgerufen werden.
export class NoDatabaseError extends MempError {
  constructor(message = "DATABASE_URL nicht konfiguriert — dieser Endpunkt benötigt Postgres") {
    super("NO_DATABASE", message, 503);
  }
}
