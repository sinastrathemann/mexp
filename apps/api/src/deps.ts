import type { PasswordHasherPort } from "@memp/application";
import { hashPassword, verifyPassword } from "@memp/auth";
import {
  RoleRepository,
  UserRepository,
  createDbClient,
} from "@memp/infrastructure";
import { loadEnv } from "@memp/shared";

const env = loadEnv();
const db = createDbClient(env.DATABASE_URL);

export const users = new UserRepository(db);
export const roles = new RoleRepository(db);

export const hasher: PasswordHasherPort = {
  hash: hashPassword,
  verify: verifyPassword,
};

export { env };
