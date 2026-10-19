const GB = 1024 * 1024 * 1024;

export function bytesToGb(bytes: number): number {
  return bytes / GB;
}

export function formatGb(bytes: number, digits = 1): string {
  return `${(bytes / GB).toFixed(digits)} GB`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;

  const seconds = ms / 1000;

  if (seconds < 60) return `${seconds.toFixed(1)} s`;

  return `${Math.floor(seconds / 60)} min ${Math.round(seconds % 60)} s`;
}

export function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString();
}

export function tokensPerSecond(tokens: number, timeMs: number): number {
  return timeMs > 0 ? Number((tokens / (timeMs / 1000)).toFixed(2)) : 0;
}

export const CONTEXT_OPTIONS = [2048, 4096, 8192, 16384, 32768, 65536, 131072];

export type Fit = "gpu" | "partial" | "cpu" | "toolarge";

/** Where a model with the given estimated memory needs would run. */
export function modelFit(
  estVramGb: number,
  estRamGb: number,
  vramTotalBytes: number,
  ramTotalBytes: number
): Fit {
  const vram = bytesToGb(vramTotalBytes);
  const ram = bytesToGb(ramTotalBytes);

  if (vram > 0 && estVramGb <= vram * 0.9) return "gpu";
  if (vram > 0 && estRamGb <= ram) return "partial";
  if (estRamGb <= ram) return "cpu";

  return "toolarge";
}

export const FIT_LABEL: Record<Fit, string> = {
  gpu: "Fits on GPU",
  partial: "Partial GPU offload",
  cpu: "CPU only",
  toolarge: "Too large",
};

export const FIT_CLASS: Record<Fit, string> = {
  gpu: "bg-green-900/60 text-green-300",
  partial: "bg-yellow-900/60 text-yellow-300",
  cpu: "bg-orange-900/60 text-orange-300",
  toolarge: "bg-red-900/60 text-red-300",
};
