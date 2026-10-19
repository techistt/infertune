import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import type { GenerateRequest, GenerateResponse } from "../types/llm";
import type { ProviderConfig } from "../types/provider";
import { getActiveConfig } from "../store/settingsStore";

interface RawResponse {
  text: string;
  tokens: number;
  generation_time: number;
  cancelled: boolean;
}

/** The argument object the backend commands expect. */
export function buildGenerateArgs(
  request: GenerateRequest,
  provider: ProviderConfig
) {
  return {
    provider,

    model: request.model,
    systemPrompt: request.systemPrompt,
    userPrompt: request.userPrompt,
    history: request.history ?? [],

    temperature: request.temperature,
    topP: request.topP,
    topK: request.topK,

    maxTokens: request.maxTokens,
    seed: request.seed,
    contextLength: request.contextLength,

    numGpu: request.numGpu ?? null,
  };
}

function toResponse(raw: RawResponse): GenerateResponse {
  return {
    text: raw.text,
    tokens: raw.tokens,
    generationTime: raw.generation_time,
    cancelled: raw.cancelled,
  };
}

/**
 * Runs one generation and resolves when it is complete.
 * Rejects with a readable message when the server cannot be reached or
 * returns an error.
 */
export async function generateText(
  request: GenerateRequest,
  provider: ProviderConfig = getActiveConfig()
): Promise<GenerateResponse> {
  const raw = await invoke<RawResponse>(
    "provider_generate",
    buildGenerateArgs(request, provider)
  );

  return toResponse(raw);
}

export interface StreamingGeneration {
  /** Resolves with the full result; rejects on errors. */
  promise: Promise<GenerateResponse>;
  /** Stops the request. The promise then resolves with the text so far. */
  cancel: () => void;
}

let requestCounter = 0;

function newRequestId(): string {
  requestCounter += 1;
  return `req-${Date.now().toString(36)}-${requestCounter}`;
}

/**
 * Like generateText, but calls `onChunk` with each piece of text as the
 * model produces it.
 */
export function streamText(
  request: GenerateRequest,
  onChunk: (delta: string) => void,
  provider: ProviderConfig = getActiveConfig()
): StreamingGeneration {
  const requestId = newRequestId();
  let unlisten: UnlistenFn | undefined;

  const promise = (async () => {
    unlisten = await listen<{ id: string; delta: string }>(
      "chat-chunk",
      (event) => {
        if (event.payload.id === requestId) {
          onChunk(event.payload.delta);
        }
      }
    );

    try {
      const raw = await invoke<RawResponse>("provider_generate_stream", {
        requestId,
        ...buildGenerateArgs(request, provider),
      });

      return toResponse(raw);
    } finally {
      unlisten?.();
    }
  })();

  return {
    promise,
    cancel: () => {
      invoke("cancel_generation", { requestId }).catch(() => {
        // Nothing to cancel if the request already finished.
      });
    },
  };
}
