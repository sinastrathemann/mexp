import type {
  AuditCreateInput,
  AuditEntityType,
  AuditRecord,
  BudgetItem,
  BudgetItemCreateInput,
  BudgetItemStatus,
  BudgetItemUpdateInput,
  Document,
  DocumentCreateInput,
  Event,
  EventCreateInput,
  EventStatus,
  EventUpdateInput,
  Participation,
  ParticipationStatus,
  ParticipationWithUser,
  Role,
  RoleName,
  User,
  UserWithPasswordHash,
} from "@memp/domain";

export interface PortfolioStats {
  eventsByStatus: Record<EventStatus, number>;
  participationByStatus: Record<ParticipationStatus, number>;
  upcomingEventsCount: number;
  attendanceRate: number | null;
  noShowRate: number | null;
  totalEvents: number;
}

export interface UserPort {
  findByEmail(email: string): Promise<UserWithPasswordHash | null>;
  findById(id: string): Promise<User | null>;
  list(): Promise<User[]>;
  create(input: {
    email: string;
    passwordHash: string;
    displayName: string;
  }): Promise<User>;
  updatePassword(userId: string, newHash: string): Promise<void>;
  setActive(userId: string, isActive: boolean): Promise<void>;
  updateLastLogin(userId: string): Promise<void>;
  assignRole(userId: string, roleId: string, assignedBy: string): Promise<void>;
  removeRole(userId: string, roleId: string): Promise<void>;
}

export interface RolePort {
  listAll(): Promise<Role[]>;
  findByName(name: RoleName): Promise<Role | null>;
}

export interface PasswordHasherPort {
  hash(plain: string): Promise<string>;
  verify(hash: string, plain: string): Promise<boolean>;
}

export interface EventPort {
  create(input: EventCreateInput): Promise<Event>;
  findById(id: string): Promise<Event | null>;
  list(filter?: { status?: EventStatus; ownerId?: string }): Promise<Event[]>;
  update(id: string, patch: EventUpdateInput): Promise<Event>;
  setStatus(id: string, status: EventStatus): Promise<Event>;
}

export interface AuditPort {
  record(input: AuditCreateInput): Promise<AuditRecord>;
  listForEntity(entityType: AuditEntityType, entityId: string): Promise<AuditRecord[]>;
}

export interface ParticipationPort {
  create(input: {
    eventId: string;
    userId: string;
    status: ParticipationStatus;
    waitlistPosition: number | null;
  }): Promise<Participation>;
  findByEventAndUser(eventId: string, userId: string): Promise<Participation | null>;
  findById(id: string): Promise<Participation | null>;
  countActiveForEvent(eventId: string): Promise<number>;
  countWaitlistForEvent(eventId: string): Promise<number>;
  findFirstWaitlisted(eventId: string): Promise<Participation | null>;
  listForEvent(eventId: string): Promise<ParticipationWithUser[]>;
  updateStatus(
    id: string,
    status: ParticipationStatus,
    changes?: {
      waitlistPosition?: number | null;
      cancelledAt?: Date | null;
      checkedInAt?: Date | null;
    },
  ): Promise<Participation>;
  shiftWaitlistPositions(eventId: string, fromPosition: number): Promise<void>;
}

export interface DashboardPort {
  portfolioStats(): Promise<PortfolioStats>;
}

export interface DocumentPort {
  create(input: DocumentCreateInput): Promise<Document>;
  findById(id: string): Promise<Document | null>;
  listForEvent(eventId: string): Promise<Document[]>;
  delete(id: string): Promise<void>;
}

export interface BudgetPort {
  create(input: BudgetItemCreateInput): Promise<BudgetItem>;
  findById(id: string): Promise<BudgetItem | null>;
  listForEvent(eventId: string): Promise<BudgetItem[]>;
  update(id: string, patch: BudgetItemUpdateInput): Promise<BudgetItem>;
  setStatus(
    id: string,
    status: BudgetItemStatus,
    extras?: {
      approverId?: string | null;
      approvedAt?: Date | null;
      rejectedReason?: string | null;
    },
  ): Promise<BudgetItem>;
}
