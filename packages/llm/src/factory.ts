import type { LlmConfig } from "./config.js";
import { MockLlmProvider } from "./providers/mock-provider.js";
import type { LlmProvider } from "./types.js";

export interface CreateProviderOptions {
  config: LlmConfig;
  providerOverride?: string;
}

export function createLlmProvider(options: CreateProviderOptions): LlmProvider {
  const override = options.providerOverride ?? process.env["LLM_PROVIDER"] ?? "mock";
  if (override === "mock") {
    return new MockLlmProvider(options.config.defaults.reasoning);
  }
  throw new Error(
    `LLM-Provider '${override}' ist konfiguriert, aber im aktuellen Build nicht implementiert.`,
  );
}
