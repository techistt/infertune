import { invoke } from "@tauri-apps/api/core";

import type {
  GenerateRequest,
  GenerateResponse,
} from "../types/llm";


export async function generateText(
  request: GenerateRequest
): Promise<GenerateResponse> {

  const response = await invoke<{
    text: string;
    tokens: number;
    generation_time: number;
  }>(
    "generate_text",
    {
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