import type { PasswordHasherPort } from "@memp/application";
import { hashPassword, verifyPassword } from "@memp/auth";
import {
  AuditRepository,
  BudgetRepository,
  DashboardRepository,
  EventRepository,
  ParticipationRepository,
  RoleRepository,
  UserRepository,
  createDbClient,
} from "@memp/infrastructure";
import { loadEnv } from "@memp/shared";

const env = loadEnv();
const db = createDbClient(env.DATABASE_URL);

export const users = new UserRepository(db);
export const roles = new RoleRepository(db);
export const events = new EventRepository(db);
export const participations = new ParticipationRepository(db);
export const audit = new AuditRepository(db);
export const dashboard = new DashboardRepository(db);
export const budgets = new BudgetRepository(db);

export const hasher: PasswordHasherPort = {
  hash: hashPassword,
  verify: verifyPassword,
};

export { env };
