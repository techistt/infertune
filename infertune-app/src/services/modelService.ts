import { invoke } from "@tauri-apps/api/core";

export async function getModels(): Promise<string[]> {
    return await invoke<string[]>("get_models");
}