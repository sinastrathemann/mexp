import { rootLogger } from "@memp/shared";
import argon2 from "argon2";
import { eq } from "drizzle-orm";
import { createDbClient } from "./client.js";
import { roles, userRoles, users } from "./schema/index.js";

try {
  process.loadEnvFile("../../.env");
} catch {
  // .env ist optional
}

const log = rootLogger.child({ module: "db-seed" });

const ROLE_DEFINITIONS = [
  { name: "read_only", description: "Portfolio lesen, eigene Teilnahmen sehen" },
  { name: "participant", description: "Normale Mitarbeitende: an Events teilnehmen" },
  { name: "event_office", description: "Event-Organisation, CRUD auf Events und Teilnehmer" },
  { name: "budget_owner", description: "Budgetfreigaben und Tax-Sicht" },
  { name: "manager", description: "Führungskraft: Freigaben, Portfolio-Sicht, Reports" },
  { name: "admin", description: "Vollzugriff inkl. Konfiguration und Blueprints" },
] as const;

const ADMIN_EMAIL = "sina.strathemann@mindsquare.de";
const ADMIN_PASSWORD = "mindsquare2026";
const ADMIN_DISPLAY_NAME = "Sina Strathemann";

async function main() {
  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) {
    throw new Error("DATABASE_URL ist nicht gesetzt.");
  }

  const db = createDbClient(databaseUrl);

  log.info("Seeding roles …");
  for (const role of ROLE_DEFINITIONS) {
    await db
      .insert(roles)
      .values({ name: role.name, description: role.description })
      .onConflictDoNothing({ target: roles.name });
  }

  const adminRole = await db.query.roles.findFirst({ where: eq(roles.name, "admin") });
  if (!adminRole) {
    throw new Error("Admin-Rolle konnte nicht geseedet werden.");
  }

  log.info({ email: ADMIN_EMAIL }, "Seeding admin user …");
  const existingAdmin = await db.query.users.findFirst({ where: eq(users.email, ADMIN_EMAIL) });

  let adminUserId: string;
  if (existingAdmin) {
    log.info({ id: existingAdmin.id }, "Admin-User existiert bereits – überspringe Anlage.");
    adminUserId = existingAdmin.id;
  } else {
    const passwordHash = await argon2.hash(ADMIN_PASSWORD, { type: argon2.argon2id });
    const [inserted] = await db
      .insert(users)
      .values({
        email: ADMIN_EMAIL,
        passwordHash,
        displayName: ADMIN_DISPLAY_NAME,
        isActive: true,
      })
      .returning({ id: users.id });
    if (!inserted) {
      throw new Error("Admin-User konnte nicht angelegt werden.");
    }
    adminUserId = inserted.id;
  }

  await db
    .insert(userRoles)
    .values({ userId: adminUserId, roleId: adminRole.id })
    .onConflictDoNothing();

  log.info({ adminUserId }, "Seed abgeschlossen ✔");
  process.exit(0);
}

main().catch((err: unknown) => {
  log.error({ err }, "Seed fehlgeschlagen");
  process.exit(1);
});
