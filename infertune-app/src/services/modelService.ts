import { invoke } from "@tauri-apps/api/core";

export interface ModelRanking {
    name: string;
    family: string;
    purpose: string;
    size_gb: number;
    score: number;
    reasons: string[];
}

export async function getModels(): Promise<string[]> {
    return await invoke<string[]>("get_models");
}

export async function getModelContextLimit(
    model: string
): Promise<number | null> {
    try {
        return await invoke<number | null>("get_model_context_limit", { model });
    } catch {
        return null;
    }
}

export async function getModelRankings(
    ramTotal: number,
    gpuMemory: number,
    vendor: string,
    task: string,
    context: number
): Promise<ModelRanking[]> {

    return await invoke<ModelRanking[]>(
        "get_model_rankings",
        {
            ramTotal,
            gpuMemory,
            vendor,
            task,
            context,
        }
    );
}