import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";

const DevUserSchema = z.object({
  id: z.string().min(1),
  email: z.string().email().nullable().default(null),
  name: z.string().nullable().default(null),
  roles: z.array(z.string()).default([]),
});

export type DevUser = z.infer<typeof DevUserSchema>;

const DEFAULT_DEV_USER: DevUser = {
  id: "dev-user-default",
  email: "dev@mindsquare.local",
  name: "Dev User",
  roles: ["AppHub.Admin"],
};

let cached: DevUser | null = null;

export function loadDevUser(): DevUser {
  if (cached) return cached;
  const path = resolve(process.cwd(), "config/dev-user.yaml");
  if (!existsSync(path)) {
    cached = DEFAULT_DEV_USER;
    return cached;
  }
  const raw = readFileSync(path, "utf8");
  const parsed = DevUserSchema.parse(parseYaml(raw));
  cached = parsed;
  return parsed;
}
