import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
  API_PORT: z.coerce.number().int().positive().default(3000),
  API_HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z.string().url(),
  AUTH_PROVIDER: z.enum(["local", "entra"]).default("local"),
  AUTH_JWT_SECRET: z.string().min(32, "AUTH_JWT_SECRET muss mindestens 32 Zeichen haben"),
  AUTH_SESSION_COOKIE_NAME: z.string().default("memp_session"),
  AUTH_SESSION_MAX_AGE_SECONDS: z.coerce.number().int().positive().default(28800),
  LLM_CONFIG_PATH: z.string().default("../../config/llm.yaml"),
  LLM_PROVIDER: z.string().default("mock"),
});

export type AppEnv = z.infer<typeof envSchema>;

let cached: AppEnv | undefined;

export function loadEnv(): AppEnv {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`ENV-Konfiguration ungültig:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}
