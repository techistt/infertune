import { invoke } from "@tauri-apps/api/core";
import type { ModelRanking } from "../store/useAppStore";
import type { ProviderConfig } from "../types/provider";

export type { ModelRanking };

export interface ModelEntry {
  name: string;
  size: number;
}

export interface ModelDetails {
  parameters_b: number | null;
  quantization: string | null;
  kv_bytes_per_token: number | null;
  max_context: number | null;
  /** Transformer layers, when the server reports it. */
  layers: number | null;
}

export interface PullProgress {
  model: string;
  status: string;
  completed: number;
  total: number;
}

/** True when the server answers; never throws. */
export async function checkProvider(provider: ProviderConfig): Promise<boolean> {
  try {
    return await invoke<boolean>("provider_status", { provider });
  } catch {
    return false;
  }
}

/** Models installed on the server. Throws with a readable message on failure. */
export async function listModels(provider: ProviderConfig): Promise<ModelEntry[]> {
  return await invoke<ModelEntry[]>("provider_models", { provider });
}

export async function getModelRankings(
  ramTotal: number,
  gpuMemory: number,
  vendor: string,
  task: string,
  context: number,
  provider: ProviderConfig
): Promise<ModelRanking[]> {
  return await invoke<ModelRanking[]>("get_model_rankings", {
    ramTotal,
    gpuMemory,
    vendor,
    task,
    context,
    provider,
  });
}

/** Largest context the model supports, or null when unknown. */
export async function getModelContextLimit(
  model: string,
  provider: ProviderConfig
): Promise<number | null> {
  try {
    return await invoke<number | null>("get_model_context_limit", {
      model,
      provider,
    });
  } catch {
    return null;
  }
}

export async function getModelDetails(
  model: string,
  provider: ProviderConfig
): Promise<ModelDetails | null> {
  try {
    return await invoke<ModelDetails | null>("get_model_details", {
      model,
      provider,
    });
  } catch {
    return null;
  }
}

/** Ollama only. Progress arrives through the "pull-progress" event. */
export async function pullModel(
  provider: ProviderConfig,
  model: string
): Promise<void> {
  await invoke("ollama_pull", { provider, model });
}

/** Ollama only. */
export async function deleteModel(
  provider: ProviderConfig,
  model: string
): Promise<void> {
  await invoke("ollama_delete", { provider, model });
}

/** Ollama only. Progress arrives through the "quantize-progress" event. */
export async function quantizeModel(
  provider: ProviderConfig,
  source: string,
  target: string,
  quantize: string
): Promise<void> {
  await invoke("ollama_quantize", { provider, source, target, quantize });
}
