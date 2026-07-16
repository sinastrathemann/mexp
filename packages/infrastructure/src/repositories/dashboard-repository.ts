import {
  EVENT_STATUSES,
  type EventStatus,
  PARTICIPATION_STATUSES,
  type ParticipationStatus,
} from "@mexp/domain";
import { gte, sql } from "drizzle-orm";
import type { DbClient } from "../db/client.js";
import { events, eventParticipations } from "../db/schema/tables.js";

export interface PortfolioStatsResult {
  eventsByStatus: Record<EventStatus, number>;
  participationByStatus: Record<ParticipationStatus, number>;
  upcomingEventsCount: number;
  attendanceRate: number | null;
  noShowRate: number | null;
  totalEvents: number;
}

export class DashboardRepository {
  constructor(private readonly db: DbClient) {}

  async portfolioStats(): Promise<PortfolioStatsResult> {
    const eventStatusRows = await this.db
      .select({
        status: events.status,
        count: sql<number>`count(*)::int`,
      })
      .from(events)
      .groupBy(events.status);

    const eventsByStatus = zeroRecord(EVENT_STATUSES);
    let totalEvents = 0;
    for (const row of eventStatusRows) {
      const s = row.status as EventStatus;
      eventsByStatus[s] = row.count;
      totalEvents += row.count;
    }

    const participationStatusRows = await this.db
      .select({
        status: eventParticipations.status,
        count: sql<number>`count(*)::int`,
      })
      .from(eventParticipations)
      .groupBy(eventParticipations.status);

    const participationByStatus = zeroRecord(PARTICIPATION_STATUSES);
    for (const row of participationStatusRows) {
      const s = row.status as ParticipationStatus;
      participationByStatus[s] = row.count;
    }

    const upcomingRows = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(events)
      .where(gte(events.startAt, new Date()));
    const upcomingEventsCount = upcomingRows[0]?.count ?? 0;

    const attendedPlusNoShow = participationByStatus.attended + participationByStatus.no_show;
    const attendanceRate =
      attendedPlusNoShow > 0 ? participationByStatus.attended / attendedPlusNoShow : null;
    const noShowRate =
      attendedPlusNoShow > 0 ? participationByStatus.no_show / attendedPlusNoShow : null;

    return {
      eventsByStatus,
      participationByStatus,
      upcomingEventsCount,
      attendanceRate,
      noShowRate,
      totalEvents,
    };
  }
}

function zeroRecord<T extends string>(keys: readonly T[]): Record<T, number> {
  const out = {} as Record<T, number>;
  for (const k of keys) out[k] = 0;
  return out;
}
