import type { Role, RoleName } from "@mexp/domain";
import { isRoleName } from "@mexp/domain";
import { eq } from "drizzle-orm";
import type { DbClient } from "../db/client.js";
import { roles } from "../db/schema/tables.js";

export class RoleRepository {
  constructor(private readonly db: DbClient) {}

  async listAll(): Promise<Role[]> {
    const rows = await this.db.select().from(roles);
    return rows.filter((r) => isRoleName(r.name)).map(toRole);
  }

  async findByName(name: RoleName): Promise<Role | null> {
    const [row] = await this.db.select().from(roles).where(eq(roles.name, name)).limit(1);
    return row && isRoleName(row.name) ? toRole(row) : null;
  }
}

function toRole(row: { id: string; name: string; description: string }): Role {
  if (!isRoleName(row.name)) {
    throw new Error(`Unbekannte Rolle in DB: ${row.name}`);
  }
  return { id: row.id, name: row.name, description: row.description };
}
