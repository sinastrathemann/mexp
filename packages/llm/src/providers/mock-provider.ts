import type { LlmCompletionRequest, LlmCompletionResponse, LlmProvider } from "../types.js";

export class MockLlmProvider implements LlmProvider {
  readonly name = "mock";
  private readonly model: string;

  constructor(model = "mock-1") {
    this.model = model;
  }

  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse> {
    const userMsg = request.messages.filter((m) => m.role === "user").pop();
    const input = userMsg?.content ?? "";
    const content = buildMockSummary(input);
    return {
      content,
      model: this.model,
      provider: this.name,
      usage: {
        inputTokens: approxTokens(input),
        outputTokens: approxTokens(content),
      },
    };
  }
}

function buildMockSummary(input: string): string {
  const lines = input.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const preview = lines.slice(0, 3).join(" · ");
  return `Zusammenfassung (Mock): ${preview || "keine Inhalte"}.`;
}

function approxTokens(text: string): number {
  return Math.max(1, Math.round(text.length / 4));
}
