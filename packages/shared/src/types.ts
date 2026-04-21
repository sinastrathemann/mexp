export type UUID = string;
export type ISODateString = string;

export type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

export interface AuditContext {
  actorId: UUID;
  actorRole: string;
  timestamp: ISODateString;
  correlationId: UUID;
}

export interface PaginationParams {
  offset: number;
  limit: number;
}

export interface PaginatedResult<T> {
  items: readonly T[];
  total: number;
  offset: number;
  limit: number;
}
