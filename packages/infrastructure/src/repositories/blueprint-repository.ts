import type {
  EventBlueprint,
  EventBlueprintCreateInput,
  EventBlueprintUpdateInput,
  EventType,
  EventVisibility,
} from "@mexp/domain";
import { desc, eq } from "drizzle-orm";
import type { DbClient } from "../db/client.js";
import type { EventBlueprintRow } from "../db/schema/tables.js";
import { eventBlueprints } from "../db/schema/tables.js";

export class BlueprintRepository {
  constructor(private readonly db: DbClient) {}

  async create(input: EventBlueprintCreateInput): Promise<EventBlueprint> {
    const [row] = await this.db
      .insert(eventBlueprints)
      .values({
        name: input.name,
        description: input.description,
        eventType: input.eventType,
        visibility: input.visibility,
        defaultDurationMinutes: input.defaultDurationMinutes,
        defaultCapacity: input.defaultCapacity,
        defaultLocation: input.defaultLocation,
        defaultDescription: input.defaultDescription,
        createdBy: input.createdBy,
      })
      .returning();
    if (!row) throw new Error("Blueprint insert returned no row");
    return rowToBlueprint(row);
  }

  async findById(id: string): Promise<EventBlueprint | null> {
    const rows = await this.db
      .select()
      .from(eventBlueprints)
      .where(eq(eventBlueprints.id, id))
      .limit(1);
    const row = rows[0];
    return row ? rowToBlueprint(row) : null;
  }

  async list(): Promise<EventBlueprint[]> {
    const rows = await this.db
      .select()
      .from(eventBlueprints)
      .orderBy(desc(eventBlueprints.updatedAt));
    return rows.map(rowToBlueprint);
  }

  async update(id: string, patch: EventBlueprintUpdateInput): Promise<EventBlueprint> {
    const values: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.name !== undefined) values["name"] = patch.name;
    if (patch.description !== undefined) values["description"] = patch.description;
    if (patch.eventType !== undefined) values["eventType"] = patch.eventType;
    if (patch.visibility !== undefined) values["visibility"] = patch.visibility;
    if (patch.defaultDurationMinutes !== undefined)
      values["defaultDurationMinutes"] = patch.defaultDurationMinutes;
    if (patch.defaultCapacity !== undefined) values["defaultCapacity"] = patch.defaultCapacity;
    if (patch.defaultLocation !== undefined) values["defaultLocation"] = patch.defaultLocation;
    if (patch.defaultDescription !== undefined)
      values["defaultDescription"] = patch.defaultDescription;
    const [row] = await this.db
      .update(eventBlueprints)
      .set(values)
      .where(eq(eventBlueprints.id, id))
      .returning();
    if (!row) throw new Error(`Blueprint ${id} not found during update`);
    return rowToBlueprint(row);
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(eventBlueprints).where(eq(eventBlueprints.id, id));
  }
}

function rowToBlueprint(row: EventBlueprintRow): EventBlueprint {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    eventType: row.eventType as EventType,
    visibility: row.visibility as EventVisibility,
    defaultDurationMinutes: row.defaultDurationMinutes,
    defaultCapacity: row.defaultCapacity,
    defaultLocation: row.defaultLocation,
    defaultDescription: row.defaultDescription,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
