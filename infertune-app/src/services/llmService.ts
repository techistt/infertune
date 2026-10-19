import { invoke } from "@tauri-apps/api/core";

import type {
  GenerateRequest,
  GenerateResponse,
} from "../types/llm";
import type { ProviderConfig } from "../types/provider";
import { getActiveConfig } from "../store/settingsStore";


/**
 * Runs one generation on the given server (the active one by default).
 * Rejects with a readable message when the server cannot be reached or
 * returns an error.
 */
export async function generateText(
  request: GenerateRequest,
  provider: ProviderConfig = getActiveConfig()
): Promise<GenerateResponse> {

  const response = await invoke<{
    text: string;
    tokens: number;
    generation_time: number;
  }>(
    "provider_generate",
    {
      provider,

      model: request.model,
      systemPrompt: request.systemPrompt,
      userPrompt: request.userPrompt,

      temperature: request.temperature,
      topP: request.topP,
      topK: request.topK,

      maxTokens: request.maxTokens,
      seed: request.seed,
      contextLength: request.contextLength,
    }
  );


  return {
    text: response.text,
    tokens: response.tokens,
    generationTime: response.generation_time,
  };
}
