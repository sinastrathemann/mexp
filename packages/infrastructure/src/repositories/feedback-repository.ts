import type { EventFeedback, EventFeedbackCreateInput, EventFeedbackStats } from "@memp/domain";
import { and, avg, count, desc, eq } from "drizzle-orm";
import type { DbClient } from "../db/client.js";
import type { EventFeedbackRow } from "../db/schema/tables.js";
import { eventFeedback } from "../db/schema/tables.js";

export class FeedbackRepository {
  constructor(private readonly db: DbClient) {}

  async create(input: EventFeedbackCreateInput): Promise<EventFeedback> {
    const [row] = await this.db
      .insert(eventFeedback)
      .values({
        eventId: input.eventId,
        userId: input.userId,
        ratingOverall: input.ratingOverall,
        ratingContent: input.ratingContent,
        ratingOrganization: input.ratingOrganization,
        comment: input.comment,
      })
      .returning();
    if (!row) throw new Error("Feedback insert returned no row");
    return rowToFeedback(row);
  }

  async findByEventAndUser(eventId: string, userId: string): Promise<EventFeedback | null> {
    const rows = await this.db
      .select()
      .from(eventFeedback)
      .where(and(eq(eventFeedback.eventId, eventId), eq(eventFeedback.userId, userId)))
      .limit(1);
    const row = rows[0];
    return row ? rowToFeedback(row) : null;
  }

  async listForEvent(eventId: string): Promise<EventFeedback[]> {
    const rows = await this.db
      .select()
      .from(eventFeedback)
      .where(eq(eventFeedback.eventId, eventId))
      .orderBy(desc(eventFeedback.submittedAt));
    return rows.map(rowToFeedback);
  }

  async statsForEvent(eventId: string): Promise<EventFeedbackStats> {
    const [row] = await this.db
      .select({
        count: count(),
        averageOverall: avg(eventFeedback.ratingOverall),
        averageContent: avg(eventFeedback.ratingContent),
        averageOrganization: avg(eventFeedback.ratingOrganization),
      })
      .from(eventFeedback)
      .where(eq(eventFeedback.eventId, eventId));
    const totalCount = Number(row?.count ?? 0);
    return {
      count: totalCount,
      averageOverall: toFloat(row?.averageOverall),
      averageContent: toFloat(row?.averageContent),
      averageOrganization: toFloat(row?.averageOrganization),
    };
  }
}

function toFloat(v: string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function rowToFeedback(row: EventFeedbackRow): EventFeedback {
  return {
    id: row.id,
    eventId: row.eventId,
    userId: row.userId,
    ratingOverall: row.ratingOverall,
    ratingContent: row.ratingContent,
    ratingOrganization: row.ratingOrganization,
    comment: row.comment,
    submittedAt: row.submittedAt,
  };
}
