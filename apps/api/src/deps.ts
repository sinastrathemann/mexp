import type { LlmPort, LlmSummaryInput } from "@memp/application";
import {
  AuditRepository,
  BlueprintRepository,
  BudgetRepository,
  DashboardRepository,
  DocumentRepository,
  EventRepository,
  FeedbackRepository,
  ParticipationRepository,
  RoleRepository,
  UserRepository,
  createDbClient,
} from "@memp/infrastructure";
import { createLlmProvider, loadLlmConfig } from "@memp/llm";
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
export const documents = new DocumentRepository(db);
export const blueprints = new BlueprintRepository(db);
export const feedback = new FeedbackRepository(db);

const llmConfig = loadLlmConfig(env.LLM_CONFIG_PATH);
const llmProvider = createLlmProvider({ config: llmConfig });

export const llm: LlmPort = {
  async summarize(input: LlmSummaryInput) {
    const res = await llmProvider.complete({
      purpose: "reasoning",
      messages: [
        { role: "system", content: input.prompt },
        { role: "user", content: input.context },
      ],
    });
    return { summary: res.content, provider: res.provider, model: res.model };
  },
};

export { env };
