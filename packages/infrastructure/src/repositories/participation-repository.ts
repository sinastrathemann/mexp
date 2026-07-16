import type { Participation, ParticipationStatus, ParticipationWithUser } from "@mexp/domain";
import { and, asc, eq, sql } from "drizzle-orm";
import type { DbClient } from "../db/client.js";
import type { EventParticipationRow } from "../db/schema/tables.js";
import { eventParticipations, users } from "../db/schema/tables.js";

export interface CreateParticipationInput {
  eventId: string;
  userId: string;
  status: ParticipationStatus;
  waitlistPosition: number | null;
}

export class ParticipationRepository {
  constructor(private readonly db: DbClient) {}

  async create(input: CreateParticipationInput): Promise<Participation> {
    const [row] = await this.db
      .insert(eventParticipations)
      .values({
        eventId: input.eventId,
        userId: input.userId,
        status: input.status,
        waitlistPosition: input.waitlistPosition,
      })
      .returning();
    if (!row) throw new Error("Participation insert returned no row");
    return rowToParticipation(row);
  }

  async findByEventAndUser(eventId: string, userId: string): Promise<Participation | null> {
    const rows = await this.db
      .select()
      .from(eventParticipations)
      .where(and(eq(eventParticipations.eventId, eventId), eq(eventParticipations.userId, userId)))
      .limit(1);
    const row = rows[0];
    return row ? rowToParticipation(row) : null;
  }

  async findById(id: string): Promise<Participation | null> {
    const rows = await this.db
      .select()
      .from(eventParticipations)
      .where(eq(eventParticipations.id, id))
      .limit(1);
    const row = rows[0];
    return row ? rowToParticipation(row) : null;
  }

  async countActiveForEvent(eventId: string): Promise<number> {
    const rows = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(eventParticipations)
      .where(
        and(eq(eventParticipations.eventId, eventId), eq(eventParticipations.status, "registered")),
      );
    return rows[0]?.count ?? 0;
  }

  async countWaitlistForEvent(eventId: string): Promise<number> {
    const rows = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(eventParticipations)
      .where(
        and(eq(eventParticipations.eventId, eventId), eq(eventParticipations.status, "waitlisted")),
      );
    return rows[0]?.count ?? 0;
  }

  async findFirstWaitlisted(eventId: string): Promise<Participation | null> {
    const rows = await this.db
      .select()
      .from(eventParticipations)
      .where(
        and(eq(eventParticipations.eventId, eventId), eq(eventParticipations.status, "waitlisted")),
      )
      .orderBy(asc(eventParticipations.waitlistPosition))
      .limit(1);
    const row = rows[0];
    return row ? rowToParticipation(row) : null;
  }

  async listForEvent(eventId: string): Promise<ParticipationWithUser[]> {
    const rows = await this.db
      .select({
        id: eventParticipations.id,
        eventId: eventParticipations.eventId,
        userId: eventParticipations.userId,
        status: eventParticipations.status,
        waitlistPosition: eventParticipations.waitlistPosition,
        registeredAt: eventParticipations.registeredAt,
        cancelledAt: eventParticipations.cancelledAt,
        checkedInAt: eventParticipations.checkedInAt,
        userEmail: users.email,
        userDisplayName: users.displayName,
      })
      .from(eventParticipations)
      .innerJoin(users, eq(eventParticipations.userId, users.id))
      .where(eq(eventParticipations.eventId, eventId))
      .orderBy(asc(eventParticipations.registeredAt));
    return rows.map((row) => ({
      id: row.id,
      eventId: row.eventId,
      userId: row.userId,
      status: row.status as ParticipationStatus,
      waitlistPosition: row.waitlistPosition,
      registeredAt: row.registeredAt,
      cancelledAt: row.cancelledAt,
      checkedInAt: row.checkedInAt,
      userEmail: row.userEmail,
      userDisplayName: row.userDisplayName,
    }));
  }

  async updateStatus(
    id: string,
    status: ParticipationStatus,
    changes: {
      waitlistPosition?: number | null;
      cancelledAt?: Date | null;
      checkedInAt?: Date | null;
    } = {},
  ): Promise<Participation> {
    const values: Record<string, unknown> = { status };
    if (changes.waitlistPosition !== undefined)
      values["waitlistPosition"] = changes.waitlistPosition;
    if (changes.cancelledAt !== undefined) values["cancelledAt"] = changes.cancelledAt;
    if (changes.checkedInAt !== undefined) values["checkedInAt"] = changes.checkedInAt;
    const [row] = await this.db
      .update(eventParticipations)
      .set(values)
      .where(eq(eventParticipations.id, id))
      .returning();
    if (!row) throw new Error(`Participation ${id} not found during update`);
    return rowToParticipation(row);
  }

  async shiftWaitlistPositions(eventId: string, fromPosition: number): Promise<void> {
    await this.db
      .update(eventParticipations)
      .set({ waitlistPosition: sql`${eventParticipations.waitlistPosition} - 1` })
      .where(
        and(
          eq(eventParticipations.eventId, eventId),
          eq(eventParticipations.status, "waitlisted"),
          sql`${eventParticipations.waitlistPosition} > ${fromPosition}`,
        ),
      );
  }
}

function rowToParticipation(row: EventParticipationRow): Participation {
  return {
    id: row.id,
    eventId: row.eventId,
    userId: row.userId,
    status: row.status as ParticipationStatus,
    waitlistPosition: row.waitlistPosition,
    registeredAt: row.registeredAt,
    cancelledAt: row.cancelledAt,
    checkedInAt: row.checkedInAt,
  };
}
