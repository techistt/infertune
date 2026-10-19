/** One earlier turn of a conversation. */
export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface GenerateRequest {
  model: string;

  systemPrompt: string;
  userPrompt: string;

  /** Earlier turns, oldest first. Leave out for a single prompt. */
  history?: ChatTurn[];

  temperature: number;
  topP: number;
  topK: number;

  maxTokens: number;
  seed: number;
  contextLength: number;

  /** Ollama only: layers to offload to the GPU. Empty means automatic. */
  numGpu?: number | null;
}

export interface GenerateResponse {
  text: string;
  tokens: number;
  generationTime: number;
  /** True when the request was stopped before the model finished. */
  cancelled?: boolean;
}
