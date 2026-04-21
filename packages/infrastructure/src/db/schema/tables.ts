import {
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
});

export const roles = pgTable("roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userRoles = pgTable(
  "user_roles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "restrict" }),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
    assignedBy: uuid("assigned_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.roleId] }),
  }),
);

export const events = pgTable("events", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  eventType: text("event_type").notNull(),
  status: text("status").notNull().default("draft"),
  visibility: text("visibility").notNull().default("internal"),
  startAt: timestamp("start_at", { withTimezone: true }).notNull(),
  endAt: timestamp("end_at", { withTimezone: true }).notNull(),
  location: text("location"),
  capacity: integer("capacity"),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const eventParticipations = pgTable(
  "event_participations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    status: text("status").notNull(),
    waitlistPosition: integer("waitlist_position"),
    registeredAt: timestamp("registered_at", { withTimezone: true }).notNull().defaultNow(),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
  },
  (t) => ({
    uniqEventUser: uniqueIndex("event_participations_event_user_uniq").on(t.eventId, t.userId),
  }),
);

export const budgetItems = pgTable("budget_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  description: text("description").notNull(),
  plannedAmountCents: integer("planned_amount_cents").notNull(),
  currency: text("currency").notNull().default("EUR"),
  status: text("status").notNull().default("draft"),
  taxNote: text("tax_note"),
  notes: text("notes"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  approverId: uuid("approver_id").references(() => users.id, { onDelete: "set null" }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  rejectedReason: text("rejected_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const documents = pgTable("documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size").notNull(),
  storageKey: text("storage_key").notNull(),
  visibility: text("visibility").notNull().default("event_staff"),
  uploadedBy: uuid("uploaded_by")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditRecords = pgTable("audit_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  action: text("action").notNull(),
  actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
  before: jsonb("before"),
  after: jsonb("after"),
  context: jsonb("context"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type UserRow = typeof users.$inferSelect;
export type UserInsert = typeof users.$inferInsert;
export type RoleRow = typeof roles.$inferSelect;
export type RoleInsert = typeof roles.$inferInsert;
export type UserRoleRow = typeof userRoles.$inferSelect;
export type UserRoleInsert = typeof userRoles.$inferInsert;
export type EventRow = typeof events.$inferSelect;
export type EventInsert = typeof events.$inferInsert;
export type EventParticipationRow = typeof eventParticipations.$inferSelect;
export type EventParticipationInsert = typeof eventParticipations.$inferInsert;
export type BudgetItemRow = typeof budgetItems.$inferSelect;
export type BudgetItemInsert = typeof budgetItems.$inferInsert;
export type DocumentRow = typeof documents.$inferSelect;
export type DocumentInsert = typeof documents.$inferInsert;
export type AuditRow = typeof auditRecords.$inferSelect;
export type AuditInsert = typeof auditRecords.$inferInsert;
