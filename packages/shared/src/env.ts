import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
  API_PORT: z.coerce.number().int().positive().default(3000),
  API_HOST: z.string().default("0.0.0.0"),
  // Postgres ist Follow-up (siehe Design-Spec §2 Non-Goals) — MVP persistiert über
  // JSON-Files im Volume (dev-persistence.ts). DATABASE_URL ist daher optional; wenn
  // gesetzt, bleibt der Postgres-Pfad rückwärtskompatibel nutzbar (apps/api/src/deps.ts).
  DATABASE_URL: z.string().url().optional(),
  LLM_CONFIG_PATH: z.string().default("../../config/llm.yaml"),
  LLM_PROVIDER: z.string().default("mock"),
  // Personio HR-Sync ist optional (siehe docs/personio-integration.md) — die App muss
  // ohne diese Werte booten; der Sync-Endpoint meldet 400, solange sie fehlen.
  PERSONIO_CLIENT_ID: z.string().optional(),
  PERSONIO_CLIENT_SECRET: z.string().optional(),
  PERSONIO_API_URL: z.string().url().default("https://api.personio.de/v1"),
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
