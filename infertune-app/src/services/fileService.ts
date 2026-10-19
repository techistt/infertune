import { invoke } from "@tauri-apps/api/core";

/** Saves text into the Downloads folder and returns the full path. */
export async function saveDownload(
  fileName: string,
  content: string
): Promise<string> {
  return await invoke<string>("save_download", { fileName, content });
}

/** Shows a file in Windows Explorer. */
export async function revealFile(path: string): Promise<void> {
  await invoke("reveal_file", { path });
}

/** "2026-10-19" style stamp for file names. */
export function dateStamp(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
