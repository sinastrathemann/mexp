export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmCompletionRequest {
  messages: LlmMessage[];
  purpose: "reasoning" | "fast" | "coding" | "embedding";
  maxTokens?: number;
  temperature?: number;
}

export interface LlmCompletionResponse {
  content: string;
  model: string;
  provider: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface LlmProvider {
  name: string;
  complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse>;
}
