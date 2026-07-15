import type { LlmPort, LlmSummaryInput } from "@memp/application";
import {
  AuditRepository,
  BlueprintRepository,
  BudgetRepository,
  type DbClient,
  DashboardRepository,
  DocumentRepository,
  EventRepository,
  FeedbackRepository,
  ParticipationRepository,
  createDbClient,
} from "@memp/infrastructure";
import { type LlmProvider, createLlmProvider, loadLlmConfig } from "@memp/llm";
import { NoDatabaseError, loadEnv } from "@memp/shared";

const env = loadEnv();

// --- Lazy Postgres client ---------------------------------------------------
// Postgres ist Follow-up (Design-Spec §2 Non-Goals). Der MVP-Boot-Pfad (Hub-Modus,
// JSON-Files im Volume) darf NIE einen Postgres-Client bei Modul-Evaluierung bauen —
// sonst crasht der Prozess vor `/health`, sobald DATABASE_URL fehlt. `getDb()` wirft
// erst beim ersten tatsächlichen Zugriff eines Postgres-Repos.
let _db: DbClient | null = null;

function getDb(): DbClient {
  if (!_db) {
    if (!env.DATABASE_URL) {
      throw new NoDatabaseError();
    }
    _db = createDbClient(env.DATABASE_URL);
  }
  return _db;
}

/**
 * Baut ein Proxy-Objekt, das die echte Repository-Instanz erst beim ersten
 * Methodenaufruf konstruiert (und damit erst dann `getDb()` aufruft). Call-Sites
 * importieren weiterhin `import { events } from "../deps.js"` und rufen
 * `events.list(...)` direkt auf — unverändert gegenüber dem eager-Export.
 */
function lazyRepo<T extends object>(create: (db: DbClient) => T): T {
  let instance: T | null = null;
  const resolve = (): T => {
    if (!instance) instance = create(getDb());
    return instance;
  };
  return new Proxy({} as T, {
    get(_target, prop, receiver) {
      const target = resolve();
      const value = Reflect.get(target as object, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

// `users`/`roles`-Repositories wurden entfernt: seit Task 3 läuft die User-/Rollen-
// Verwaltung über den Datei-basierten `mempUserStore` (routes/_user-resolution.ts).
// Kein Call-Site importiert `users`/`roles` mehr aus diesem Modul (verifiziert per grep).
export const events = lazyRepo((db) => new EventRepository(db));
export const participations = lazyRepo((db) => new ParticipationRepository(db));
export const audit = lazyRepo((db) => new AuditRepository(db));
export const dashboard = lazyRepo((db) => new DashboardRepository(db));
export const budgets = lazyRepo((db) => new BudgetRepository(db));
export const documents = lazyRepo((db) => new DocumentRepository(db));
export const blueprints = lazyRepo((db) => new BlueprintRepository(db));
export const feedback = lazyRepo((db) => new FeedbackRepository(db));

// --- Lazy LLM provider -------------------------------------------------------
// config/llm.yaml: "Gerüst für Phase 4. Im MVP nicht aktiv." Wird im MVP-Boot-Pfad
// nie konstruiert — nur falls `feedback.summarize()` tatsächlich aufgerufen wird.
let _llmProvider: LlmProvider | null = null;

function getLlmProvider(): LlmProvider {
  if (!_llmProvider) {
    const llmConfig = loadLlmConfig(env.LLM_CONFIG_PATH);
    _llmProvider = createLlmProvider({ config: llmConfig });
  }
  return _llmProvider;
}

export const llm: LlmPort = {
  async summarize(input: LlmSummaryInput) {
    const res = await getLlmProvider().complete({
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
