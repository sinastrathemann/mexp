import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { z } from "zod";

const modelSchema = z.object({
  id: z.string(),
  max_tokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
});

const providerSchema = z.object({
  api_key: z.string().nullish(),
  base_url: z.string().url().nullish(),
  models: z.array(modelSchema).default([]),
});

const llmConfigSchema = z.object({
  defaults: z.object({
    reasoning: z.string(),
    fast: z.string(),
    coding: z.string(),
    embedding: z.string().optional(),
  }),
  providers: z.record(z.string(), providerSchema).default({}),
  resilience: z
    .object({
      max_retries: z.number().int().nonnegative().default(3),
      retry_delay_ms: z.number().int().nonnegative().default(1000),
      timeout_ms: z.number().int().positive().default(30000),
      rate_limit_rpm: z.number().int().positive().default(60),
    })
    .default({}),
});

export type LlmConfig = z.infer<typeof llmConfigSchema>;

export function loadLlmConfig(path: string): LlmConfig {
  const raw = readFileSync(path, "utf8");
  const expanded = raw.replace(/\$\{([A-Z0-9_]+)\}/g, (_, key) => process.env[key] ?? "");
  const parsed = parseYaml(expanded) as unknown;
  return llmConfigSchema.parse(parsed);
}
