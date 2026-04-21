import type {
  Event,
  EventCreateInput,
  EventStatus,
  EventType,
  EventUpdateInput,
  EventVisibility,
} from "@memp/domain";
import { and, desc, eq } from "drizzle-orm";
import type { DbClient } from "../db/client.js";
import type { EventRow } from "../db/schema/tables.js";
import { events } from "../db/schema/tables.js";

export interface EventListFilter {
  status?: EventStatus;
  ownerId?: string;
}

export class EventRepository {
  constructor(private readonly db: DbClient) {}

  async create(input: EventCreateInput): Promise<Event> {
    const [row] = await this.db
      .insert(events)
      .values({
        title: input.title,
        description: input.description,
        eventType: input.eventType,
        visibility: input.visibility,
        startAt: input.startAt,
        endAt: input.endAt,
        location: input.location,
        capacity: input.capacity,
        ownerId: input.ownerId,
      })
      .returning();
    if (!row) throw new Error("Event insert returned no row");
    return rowToEvent(row);
  }

  async findById(id: string): Promise<Event | null> {
    const rows = await this.db.select().from(events).where(eq(events.id, id)).limit(1);
    const row = rows[0];
    return row ? rowToEvent(row) : null;
  }

  async list(filter: EventListFilter = {}): Promise<Event[]> {
    const conditions = [];
    if (filter.status) conditions.push(eq(events.status, filter.status));
    if (filter.ownerId) conditions.push(eq(events.ownerId, filter.ownerId));
    const query = this.db.select().from(events).orderBy(desc(events.startAt));
    const rows = conditions.length > 0 ? await query.where(and(...conditions)) : await query;
    return rows.map(rowToEvent);
  }

  async update(id: string, patch: EventUpdateInput): Promise<Event> {
    const values: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.title !== undefined) values["title"] = patch.title;
    if (patch.description !== undefined) values["description"] = patch.description;
    if (patch.eventType !== undefined) values["eventType"] = patch.eventType;
    if (patch.visibility !== undefined) values["visibility"] = patch.visibility;
    if (patch.startAt !== undefined) values["startAt"] = patch.startAt;
    if (patch.endAt !== undefined) values["endAt"] = patch.endAt;
    if (patch.location !== undefined) values["location"] = patch.location;
    if (patch.capacity !== undefined) values["capacity"] = patch.capacity;
    const [row] = await this.db.update(events).set(values).where(eq(events.id, id)).returning();
    if (!row) throw new Error(`Event ${id} not found during update`);
    return rowToEvent(row);
  }

  async setStatus(id: string, status: EventStatus): Promise<Event> {
    const [row] = await this.db
      .update(events)
      .set({ status, updatedAt: new Date() })
      .where(eq(events.id, id))
      .returning();
    if (!row) throw new Error(`Event ${id} not found during status update`);
    return rowToEvent(row);
  }
}

function rowToEvent(row: EventRow): Event {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    eventType: row.eventType as EventType,
    status: row.status as EventStatus,
    visibility: row.visibility as EventVisibility,
    startAt: row.startAt,
    endAt: row.endAt,
    location: row.location,
    capacity: row.capacity,
    ownerId: row.ownerId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
