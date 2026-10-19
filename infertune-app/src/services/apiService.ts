import { invoke } from "@tauri-apps/api/core";
import type { ProviderConfig } from "../types/provider";

export interface ApiStatus {
  running: boolean;
  port: number;
  requests: number;
}

export async function startApiServer(
  provider: ProviderConfig,
  port: number,
  token: string
): Promise<ApiStatus> {
  return await invoke<ApiStatus>("api_server_start", {
    provider,
    port,
    token: token.trim() === "" ? null : token.trim(),
  });
}

export async function stopApiServer(): Promise<void> {
  await invoke("api_server_stop");
}

/** Null when the server is not running (or the backend is unreachable). */
export async function getApiStatus(): Promise<ApiStatus | null> {
  try {
    return await invoke<ApiStatus | null>("api_server_status");
  } catch {
    return null;
  }
}

export async function setCloseToTray(enabled: boolean): Promise<void> {
  try {
    await invoke("set_close_to_tray", { enabled });
  } catch {
    // Not running inside the desktop app.
  }
}
